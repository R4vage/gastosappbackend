import { CategoryList, ExpenseList } from "../models/index.js";


const getExpenseList = async (req, res) => { //Para pedir el listado de categorias
    const {user} = req //Este user viene dado por el checkAuth
    const expenseList = await ExpenseList.findOne({userID: user._id}).select("expenses -_id") //Buscamos la expenseList del usuario, y le sacamos la info que no nos sirve
    if (!expenseList){
        res.status(400).json({ msg: "Listado de gastos no encontrado" , error:true})
    }
    res.json(expenseList)
}


const addExpense = async (req, res) => {
    const {user} = req
    const { expenseName, expenseValue, expenseDate, categoryName } = req.body
    const expenseList = await ExpenseList.findOne({userID: user._id}) //arrancamos buscando la lista

    if (!expenseList){
        res.status(400).json({ msg: "Listado de gastos no encontrado" , error:true})
    }

    const categoryList = await CategoryList.findOne ({ userID: user._id})

    if (!categoryList){
        res.status(400).json({ msg: "Listado de categorias no encontrado" , error:true })
    }

    const categoryExists = categoryList.categories.find(category => category.name === categoryName);
    console.log(categoryExists)
    if (!categoryExists) {
        res.status(400).json({ msg: "Categoría no encontrada", error:true})
    } else { 
    expenseList.expenses.push({name: expenseName, value: expenseValue, date: expenseDate, categoryID: categoryExists._id}) //Agregamos el gasto a la lista
    try {
        await expenseList.save(); //Guardamos la nueva lista
        res.status(201).json({msg: "Gasto creado exitosamente"});
    } catch (error) {
        return res.status(409).json({msg: `Ocurrió un error: ${error}` , error:true})
    }}

}


const removeExpense = async (req, res) => {
    const {user} = req
    const { expenseID } = req.body
    const expenseList = await ExpenseList.findOne({userID: user._id})
    if (!expenseList){
        res.status(400).json({ msg: "Listado de gastos no encontrado" , error:true})
    }
    const expenseExists = expenseList.expenses.findIndex(expense => expense._id.toString() === expenseID); //Aca nos aseguramos que el gasto exista, y extraemos su index
    if(expenseExists !== -1){
        console.log(expenseList.expenses.expenseExists)
        expenseList.expenses.splice(expenseExists, 1) //Sacamos la categoria del listado
        try { 
            await expenseList.save(); //Guardamos el listado
            res.status(201).json({msg: "Gasto eliminado exitosamente"}); //Le puse un 201 en vez de un 204 para poder mandar un json de respuesta, personalmente prefiero ver que reciba algo
        } catch (error) {
            return res.status(409).json({msg: `Ocurrió un error: ${error}` , error:true})
        }
    } else {
        return res.status(400).json({msg:"El gasto no existe" , error:true})
    }
}


const changeExpense = async (req, res) => {
    const { user } = req
    const { expenseID, newExpenseName, newExpenseValue, newCategory, newExpenseDate } = req.body
    const expenseList = await ExpenseList.findOne({userID: user._id})
    if (!expenseList){
        res.status(400).json({ msg: "Listado de gastos no encontrado" , error:true})
    }
    if(!newExpenseName && !newExpenseValue && !newCategory && !newExpenseDate) {
        return res.status(400).json({msg: "No hay cambios a realizar" , error:true})
    }
    const expenseExists = expenseList.expenses.findIndex(expense => expense._id.toString() === expenseID);
    if (expenseExists !== -1){

        if(newCategory){
            const categoryList = await CategoryList.findOne ({ userID: user._id});
            const categoryExists = categoryList.categories.find(category => category.name === newCategory);
            if (!categoryExists) {
                return res.status(400).json({msg: "La categoria no existe", error: true})
            } else {
                expenseList.expenses[expenseExists].categoryID = categoryExists._id
            }
        }
        if (newExpenseName){
            expenseList.expenses[expenseExists].name = newExpenseName
        }

        if (newExpenseDate){
            expenseList.expenses[expenseExists].date = newExpenseDate
        }

        if (newExpenseValue){
            expenseList.expenses[expenseExists].value = newExpenseValue
        } // Habria que refinar esta parte, está poco legible.

        try {
            await expenseList.save(); //Guardamos el listado
            res.status(201).json({msg: "Gasto modificado exitosamente"});
        } catch (error){
            return res.status(409).json({msg: `Ocurrió un error: ${error}` , error:true})
        }
    } else {
        return res.status(400).json({msg:"El gasto no existe" , error:true})
    }
}

const searchExpense = async (req, res) => { //Para pedir el listado de categorias
    const { user } = req //Este user viene dado por el checkAuth
    const { search, minValue, maxValue, minDate, maxDate, page, limit, sortBy, desc, categoryID } = req.query //sortBy puede ser value, date o name, desc puede ser 1 o -1
    console.log(req.query)
    const regex = new RegExp(search,'i')
    console.log(search)
    const expenseList = await ExpenseList.aggregate([
        {$match: {userID: `${user._id}`}},
        {$project:{
            expenses:{
                $filter:{
                    input:`$expenses`,
                    as: `item`,
                    cond:{$and: [
                        (search)?{$regexFind:{input: "$$item.name", regex: regex}}:{$eq:["$$item.name","$$item.name"]},//Buscamos por nombre, si no hay nombre devuelve todo.
                        
                        (minValue || maxValue )?{$and: [
                                {"$gte": [
                                    "$$item.value",
                                    parseInt(minValue)//Checkeamos que sea mas grande que el valor minimo
                                ]},
                                parseInt(maxValue)?{"$lte": [
                                    "$$item.value",
                                    parseInt(maxValue)//Checkeamos que sea mas chico que el valor máximo. Si no hay valor devuelve todo.
                                ]}:{}
                            ]}:{},

                        (minDate || maxDate)? //Este se encarga de filtrar por fecha
                            {$and: [
                                {"$gte": [
                                    "$$item.date",
                                    {
                                        $dateFromString: {
                                            dateString: minDate,
                                            format: "%Y-%m-%d"
                                        }
                                    }//Checkeamos que sea mas grande que el valor minimo
                                ]},
                                maxDate?{"$lte": [ "$$item.date",
                                {
                                    $dateFromString: {
                                        dateString: maxDate,
                                        format: "%Y-%m-%d"
                                    }
                                }//Si no hay valor, devuelve sin limite máximo de fecha
                                ]}:{}
                            ]}:{},

                        (categoryID)?{//Filtramos por categoría
                            $eq:["$$item.categoryID",
                            categoryID]
                        }:{}
                    ]}
                }
            }
        }},
        {$unwind:"$expenses"},
        {$sort:{[sortBy?`expenses.${sortBy}`:"expenses.name"]:parseInt(desc)}},
        { "$facet": {
            "expenses": [
                { "$skip": (page-1)*limit }, // El skip y limit estan para la paginación
                { "$limit": parseInt(limit)},
                {"$group":{"expenses":{"$push":"$expenses"}}}
            ],
            "totalCount": [
                { "$count": "count" } //Total count para ayudar a hacer la paginación en el frontend
            ]
        }}
    ])
    const results = expenseList[0]
    if(results.totalCount.length === 0){
        return res.status(400).json({msg: "No hay ningun resultado para esta búsqueda" , error:true})
    }
    if(Math.ceil(results.totalCount[0].count/limit) < page) {
        return res.status(400).json({msg: "No hay suficientes items para acceder a esta página" , error:true})
    }
    if (results){
        return res.status(200).json(results)
    }else{
        return res.status(400).json("Error crítico, por favor, comuniquesé con algún administrador")
    }
}


export {getExpenseList, addExpense, removeExpense, changeExpense, searchExpense}



/* const searchExpenseListByName = async (req, res) => { //Para pedir el listado de categorias
    const {user} = req //Este user viene dado por el checkAuth
    const { search, page, limit, sortBy, desc } = req.query
    console.log(req.query)
    const expenseList = await ExpenseList.findOne({userID: user._id}).select("expenses -_id") //Buscamos la expenseList del usuario, y le sacamos la info que no nos sirve
    if (!expenseList){
        res.status(400).json({ msg: "Listado de gastos no encontrado" , error:true})
    }
    const searchedList = expenseList.expenses.filter(expense => expense.name.includes(search))
    if(searchedList.length === 0) {
        return res.status(400).json({msg: "No hay ningun gasto que contenga ese nombre" , error:true})
    }
    if (Math.ceil(searchedList.length/limit) < page) {
        return res.status(400).json({msg: "No hay suficientes items para acceder a esta página" , error:true})
    }
    const sortedList = sortArray(searchedList, sortBy, desc)
    const totalItems = searchedList.length
    const limitList = sortedList.splice((page-1)*limit,limit)
  
    
    if (limitList){
        return res.status(200).json({results:limitList, totalItems: totalItems, currentItems: limitList.length})
    } 
} */ //este hermoso snippet de código era una solución alternativa, aunque poco performante para realizar la busqueda. Basicamente realiza todo con javascript. Me daba lástima eliminarlo.


/* const searchExpenseListByName = async (req, res) => { //Para pedir el listado de categorias
    const { user } = req //Este user viene dado por el checkAuth
    const { search, page, limit, sortBy, desc } = req.query //sortBy puede ser value, date o name, desc puede ser 1 o -1
    console.log(req.query)
    const regex = new RegExp(search,'i')
    const expenseList = await ExpenseList.aggregate([
        {$match: {userID: `${user._id}`}},
        {$project:{
            expenses:{
                $filter:{
                    input:`$expenses`,
                    as: `item`,
                    cond: {$regexFind:{input: "$$item.name", regex: regex}}
                }
            }
        }},
        {$unwind:"$expenses"},
        {$sort:{[sortBy?`expenses.${sortBy}`:"expenses.name"]:parseInt(desc)}},
        { "$facet": {
            "expenses": [
              { "$skip": (page-1)*limit },
              { "$limit": parseInt(limit)},
              {"$group":{"_id":"$_id", "expenses":{"$push":"$expenses"}, "regexMatch":{"$push":"$regexMatch"}}}
            ],
            "totalCount": [
              { "$count": "count" }
            ]
        }}
    ])
    const results = expenseList[0]
    if(results.totalCount.length === 0){
        return res.status(400).json({msg: "No hay ningun gasto que contenga ese nombre" , error:true})
    }
    if(Math.ceil(results.totalCount[0].count/limit) < page) {
        return res.status(400).json({msg: "No hay suficientes items para acceder a esta página" , error:true})
    }
    if (results){
        return res.status(200).json(results)
    }else{
        return res.status(400).json("Error crítico, por favor, comuniquesé con algún administrador")
    }}


    const searchExpenseListByValue = async (req, res) => { //Para pedir el listado de categorias
        const { user } = req //Este user viene dado por el checkAuth
        const { minValue, maxValue, page, limit, sortBy, desc } = req.query //sortBy puede ser value, date o name, desc puede ser 1 o -1
        console.log(req.query)
        if(maxValue<minValue){
            return res.status(400).json({msg: "Valor mínimo no puede ser mayor a valor máximo" , error:true})
        }
        const expenseList = await ExpenseList.aggregate([
            {$match: {userID: `${user._id}`}},
            {$project:{
                expenses:{
                    $filter:{
                        input:`$expenses`,
                        as: `item`,
                        cond: {
                            $or:[
                                {$and: [
                                    {"$gte": [
                                        "$$item.value",
                                        parseInt(minValue)
                                    ]},
                                    {"$lt": [
                                        "$$item.value",
                                        parseInt(maxValue)
                                    ]}
                                ]},
                                {$eq:["$$item.value",
                                parseInt(minValue)]},
                                {$eq:["$$item.value",
                                parseInt(maxValue)]}
                            ]
                        }
                    }
                }
            }},
            {$unwind:"$expenses"},
            {$sort:{[`expenses.${sortBy}`]:parseInt(desc)}},
            { $facet: {
                "expenses": [
                  { $skip: (page-1)*limit },
                  { $limit: parseInt(limit)},
                  { $group:{"_id":"$_id", "expenses":{$push:"$expenses"}}}
                ],
                "totalCount": [
                  { $count: "count" }
                ]
            }}
        ])
        const results = expenseList[0]
        if(results.totalCount.length === 0){
            return res.status(400).json({msg: "No hay ningun gasto con ese valor" , error:true})
        }
        if(Math.ceil(results.totalCount[0].count/limit) < page) {
            return res.status(400).json({msg: "No hay suficientes items para acceder a esta página" , error:true})
        }
        if (results){
            return res.status(200).json(results)
        }else{
            return res.status(400).json({msg:"Error crítico, por favor, comuniquesé con algún administrador", error:true})
        }} */ // En un principio los controladores iban a estar divididos.