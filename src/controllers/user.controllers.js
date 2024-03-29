import { User, ExpenseList, CategoryList } from "../models/index.js";
import { createJWT, createJWTConfirmed, createJWTForgot } from "../helpers/createJWT.js";
import { emailForgot, emailToken } from "../helpers/emailHelper.js";
import jwt from "jsonwebtoken"


//Este controlador crea un nuevo usuario.
const createNewUser = async (req, res) => {
    
        const { email } = req.body; // se extrae el email
        const existUser = await User.findOne ({email: email})
        if (existUser) {
            return res.status(400).json({msg: "Usuario ya está registrado", error:true})
        } //Si ya existe devolvemos un error
        
        try{
            const user = new User(req.body)
            const rawCategoryList = {
                userID: user._id,
                categories: [
                    {
                        name: "Inversiones",
                        color: "Green"
                    },
                    {
                        name: "Transporte",
                        color: "Red"
                    },
                    {
                        name: "Comida",
                        color: "Orange"
                    },
                    {
                        name: "Servicios",
                        color: "Blue"
                    },
                    {
                        name: "Otros",
                        color: "Yellow"
                    }
                ]
            }
            const categoryList = new CategoryList(rawCategoryList)
            const rawExpenseList = {
                userID: user._id,
                expenses: []
            }
            const expenseList = new ExpenseList(rawExpenseList)
            user.tokenConfirm = createJWTConfirmed(user.email) //Sin restricción de tiempo. Solo queremos un token que vamos a usar para el confirmed
            await user.save(); //Aca iria el metodo del mail para el confirmed
            await categoryList.save();
            await expenseList.save();
            emailToken({email: user.email, name: user.name, tokenConfirm: user.tokenConfirm})
            res.json({
                msg: "Usuario creado con exito, recibirá un email para confirmar su cuenta"
            });

        } catch(error) {
            return res.status(400).json({
                msg: `Lo sentimos, ocurrio un error al crear el usuario. Por favor, comunique el siguiente codigo a un administrador ${error}`
            })
        }
};

// Para el logueo
const authenticate = async (req, res) => {
    const {email, password} = req.body;
    const user = await User.findOne({email: email }); //Buscamos al usuario
    if (!user) {
        return res.status(400).json({msg: "El usuario no está registrado" , error: true}); //Si no está, devolvemos un error
    }

    if (await user.checkPassword(password)) {
        
        if (!user.confirmed) {
            return res.status(400).json({msg: "Usuario no está confirmado", error: true})
        }

        return res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: createJWT(user._id) // Aca va el token, con un timer, ya que este si tiene que expirar
        })
    } else {
        return res.status(400).json({msg: "La contraseña es incorrecta" , error: true})
    }
};

// Para el confirmar la cuenta
const confirmUser = async (req, res) => {
    const { token } = req.params; //extraemos el token de la url
    const userConfirmed = await User.findOne ({tokenConfirm: token})
    if (!userConfirmed){
        return res.status(400).json({msg: "Token incorrecto", error:true}); //Hay que hacer una view para el caso de que se ingrese a una página con token incorrecto. O usar 
    }

    try{
        userConfirmed.confirmed = true;
        userConfirmed.tokenConfirm = ""; //dejamos el token vacio, ya que la cuenta ya está confirmada. Hay un caso extremo que generaria problemas, en el caso de que el usuario se olvide la contraseña antes de confirmar su cuenta. Por ahí en lugar de un solo token, hacer dos tokens distintos. RESUELTO
        await userConfirmed.save();
        res.json({msg: "Usuario confirmado con éxito" })
    } catch(error) {
        return res.status(400).json({
            msg: `Lo sentimos, ocurrio un error al confirmar el usuario. Por favor, comunique el siguiente codigo a un administrador ${error}`, error: true
        })
    }
};

const forgotPassword = async (req, res) => {//Para el caso que el user se olvide la contraseña
    const { email } = req.body;
    const user = await User.findOne({email: email}); //buscamos si hay un usuario registrado con ese email
    if (!user) {
        return res.status(400).json({msg: "Usuario no encontrado", error:true})
    }

    try {
        user.tokenForgot = createJWTForgot()//creamos un token con timer (1 dia)
        await user.save(); //Guardamos el token
        emailForgot({email: user.email, name: user.name, tokenForgot: user.tokenForgot})//enviamos el mail al user
        res.json({msg:"Enviamos un e-mail con instrucciones a su casilla"});
    } catch (error) {
        return res.status(400).json({
            msg: `Lo sentimos, ocurrio un error, por favor, intente nuevamente. Si el problema persiste, comunique el siguiente codigo a un administrador ${error}`, error:true
        })

    }
};

const checkForgotToken = async (req, res) => { //Aca checkeamos que el token sea valido, de serlo, ahi se mostraria la view para el cambio de contraseña
    const { token } = req.params;
    try {
        jwt.verify(token, process.env.JWT_SECRET)
    } catch(err) {
        return res.status(400).json({ msg: "Su token es invalido o ha expirado." + err, error: true})
    }
    const validToken = await User.findOne ({ tokenForgot: token });
    if (validToken) {
        res.json({msg: "El token es correcto y el usuario existe", error: true});   
    } else {
        return res.status(400).json({ msg: "Este token no fue generado por un usuario, o ya ha sido utilizado" , error:true})
    }
};

const changeForgotPassword = async (req, res) => {
    const { token } = req.params; //Sacamos el token, ya que lo vamos a verificar de nuevo antes de realizar el cambio de password
    const { password } = req.body; //Checkeamos de recibir una password
    try {
        jwt.verify(token, process.env.JWT_SECRET)
    } catch(err) {
        return res.status(400).json({ msg: "Su token es invalido o ha expirado." + err, error: true})
    }// Seguramente hay una mejor forma de hacer esto. Ademas se podría modularizar esta porción de codigo, ya que la verificación del JWT va a ser utilizada en otros lares
    const user = await User.findOne({ tokenForgot: token }) //Checkeamos si tenemos un usuario guardado en la bdd que haya tenga dicho token
 
    if (user) {

        user.password = password; //Cambiamos la contraseña. En el modelo esta instaurado el bcrypt, para que realize el hasheo de la contra
        user.tokenForgot = ""; //Eliminamos el token despues de usarlo
        try {
            await user.save();
            res.json({ msg: "La contraseña se ha modificado exitosamente", error:true});
        } catch (error) {
            return res.status(400).json({
                msg: `Lo sentimos, ocurrio un error, por favor, intente nuevamente. Si el problema persiste, comunique el siguiente codigo a un administrador ${error}`,
                error: true
            })
        }
    } else {
        return res.status(400).json({ msg: "Este token no fue generado por un usuario, o ya ha sido utilizado", error: true });
    }
}

const userProfile = async (req, res) =>{
    const { user } = req;
    const fullUser = await User.findById(user._id).select("-password -tokenForgot -tokenConfirm -isDeleted -confirmed  -updatedAt -__v");
    res.json(fullUser)
}

const changeProfile = async (req, res) =>{
    const { user } = req;
    const { name, lastName, birthday} = req.body;
    const fullUser = await User.findById(user._id);
    if (name === fullUser.name && lastName === fullUser.lastName){
        return res.status(400).json({msg: "No hubo cambios", error: true})
    };
    if(name && fullUser.name !== name) {
        fullUser.name = name
    }
    if(lastName && fullUser.lastName !== name) {
        fullUser.name = name
    } //Por ahí podria cambiar esto y hacer un controlador para cada cambio, pero me parece mas engorroso
    try {
        await fullUser.save();
        res.json({msg: "Datos modificados con éxito"})
    } catch (error) {
        return res.status(400).json({msg: `Ha ocurrido un error: ${error}, sus datos no han sido modificados`, error: true})
    }
}






export {createNewUser, authenticate, confirmUser, forgotPassword, checkForgotToken, changeForgotPassword, userProfile, changeProfile}