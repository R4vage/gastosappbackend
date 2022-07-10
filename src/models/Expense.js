import mongoose from "mongoose";

const expenseSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true, // hace que este campo sea obligatorio
            trim: true // te quita los espacios de adelante y de atras
        },

        value: {
            type: Number, //Habria que ver como reacciona a los decimales. Round a dos decimales por ahora, y si tenemos tiempo ver de hacer algo para mas precisión.
            required: true,
            trim: true 
        },
        
        
  },
)

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;