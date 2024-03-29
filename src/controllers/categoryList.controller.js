import { CategoryList, ExpenseList } from "../models/index.js";

const getCategoryList = async (req, res) => { //Para pedir el listado de categorias
    const {user} = req //Este user viene dado por el checkAuth
    const categoryList = await CategoryList.findOne({userID: user._id}).select("categories -_id") //Buscamos la categoryList del usuario, y le sacamos la info que no nos sirve
    if (!categoryList){
        res.status(400).json({ msg:"Listado de categorias no encontrado", error: true})
    } else { res.json(categoryList) }
}

const addCategory = async (req, res) => {
    const {user} = req
    const { categoryName, categoryColor } = req.body
    const categoryList = await CategoryList.findOne({userID: user._id}) //arrancamos buscando la lista
    if (!categoryList){
        res.status(400).json({ msg: "Listado de categorias no encontrado" , error: true})
    }
    const categoryExists = categoryList.categories.find(category => category.name === categoryName); //Nos aseguramos que el item no exista
    if(!categoryExists || categoryList.categories === []){
        categoryList.categories.push({name: categoryName, color: categoryColor}) //Agregamos la categoria a la lista
        try {
            await categoryList.save(); //Guardamos la nueva lista
            res.status(201).json({msg: "Categoria creada exitosamente"});
        } catch (error) {
            return res.status(409).json({msg: `Ocurrió un error: ${error}` , error: true})
        }
    } else {
        return res.status(400).json({msg:"La categoria ya existe" , error: true})
    }
}

const removeCategory = async (req, res) => {
    const {user} = req
    const { categoryName } = req.body
    const categoryList = await CategoryList.findOne({userID: user._id})
    if (!categoryList){
        res.status(400).json({ msg: "Listado de categorias no encontrado" , error: true})
    }
    const categoryExists = categoryList.categories.findIndex(category => category.name === categoryName); //Aca nos aseguramos que la categoria exista, y extraemos su index
    if(categoryExists !== -1){
        const expenseList = await ExpenseList.aggregate([
            {$match: {userID: `${user._id}`}},
            {$project:{
                expenses:{
                    $filter:{
                        input:`$expenses`,
                        as: `item`,
                        cond:{$eq:["$$item.categoryID", categoryList.categories[categoryExists]._id.toString()]
                        }
                    }
                }
            }}
        ]);
        if (expenseList[0].expenses.length !== 0){
            return res.status(400).json({msg:"Hay gastos en esta categoria, por favor, eliminelos, o cambielos de categoria", error:true})
        }
        categoryList.categories.splice(categoryExists, 1); //Sacamos la categoria del listado
        try { 
            await categoryList.save(); //Guardamos el listado
            res.status(201).json({msg: "Categoria eliminada exitosamente"}); //Le puse un 201 en vez de un 204 para poder mandar un json de respuesta, personalmente prefiero ver que reciba algo
        } catch (error) {
            return res.status(409).json({msg: `Ocurrió un error: ${error}` , error: true});
        }
    } else {
        return res.status(400).json({msg:"La categoria no existe" , error: true});
    }
}

const changeCategory = async (req, res) => {
    const { user } = req;
    const { categoryName, newCategoryName, newCategoryColor } = req.body;
    const categoryList = await CategoryList.findOne({userID: user._id});
    if (!categoryList){
        res.status(400).json({ msg: "Listado de categorias no encontrado" , error: true});
    }
    if(!newCategoryName && !newCategoryColor) {
        return res.status(400).json({msg: "No hay cambios a realizar" , error: true})
    }
    const categoryExists = categoryList.categories.findIndex(category => category.name === categoryName);
    const newCategoryNameInUse = categoryList.categories.findIndex(category => category.name === newCategoryName);
    if (newCategoryNameInUse !== -1) {
        return res.status(400).json({msg: "Ya existe una categoría con ese nombre" , error: true})
    }
    if (categoryExists !== -1){
        if(categoryList.categories[categoryExists].name === newCategoryName && 
            categoryList.categories[categoryExists].color === newCategoryColor) {
                return res.status(400).json({msg: "No hay cambios" , error: true})
        }

        if (newCategoryName && categoryName !== newCategoryName){
            categoryList.categories[categoryExists].name = newCategoryName
        }

        if (newCategoryColor && categoryList.categories[categoryExists].color !== newCategoryColor){
            categoryList.categories[categoryExists].color = newCategoryColor
        } // Habria que refinar esta parte, está poco legible.

        try {
            await categoryList.save(); //Guardamos el listado
            res.status(201).json({msg: "Categoria modificada exitosamente"});
        } catch (error){
            return res.status(409).json({msg: `Ocurrió un error: ${error}` , error: true})
        }
    } else {
        return res.status(400).json({msg:"La categoria no existe" , error: true})
    }
}



const addCategoryLimit = async (req, res) => {
    const {user} = req
    const { categoryName, categoryLimit } = req.body
    if (!categoryLimit || isNaN(parseInt(categoryLimit))){
        res.status(400).json({ msg: "Debe colocar un limite numérico" , error: true})
    }
    const categoryList = await CategoryList.findOne({userID: user._id})
    if (!categoryList){
        res.status(400).json({ msg: "Listado de categorias no encontrado" , error: true})
    }
    const categoryExists = categoryList.categories.findIndex(category => category.name === categoryName); //Aca nos aseguramos que la categoria exista, y extraemos su index
    if(categoryExists !== -1){
        categoryList.categories[categoryExists].categoryLimit = parseInt(categoryLimit)
        try { 
            await categoryList.save(); //Guardamos el listado
            res.status(201).json({msg: "Limite agregado exitosamente"}); //Le puse un 201 en vez de un 204 para poder mandar un json de respuesta, personalmente prefiero ver que reciba algo
        } catch (error) {
            return res.status(409).json({msg: `Ocurrió un error: ${error}` , error: true});
        }
    } else {
        return res.status(400).json({msg:"La categoria no existe" , error: true});
    }
}

const getCategoryLimit = async (req, res) => {
    const {user} = req
    const { categoryName } = req.query
    const categoryList = await CategoryList.findOne({userID: user._id})
    if (!categoryList){
        res.status(400).json({ msg: "Listado de categorias no encontrado" , error: true})
    }
    const categoryExists = categoryList.categories.findIndex(category => category.name === categoryName); //Aca nos aseguramos que la categoria exista, y extraemos su index
    if(categoryExists !== -1){
        res.status(200).json({totalCategoryLimit: categoryList.categories[categoryExists].categoryLimit, categoryName:categoryList.categories[categoryExists].name })
    } else {
        return res.status(400).json({msg:"La categoria no existe" , error: true});
    }
}

export { getCategoryList, addCategory, removeCategory, changeCategory, addCategoryLimit, getCategoryLimit }