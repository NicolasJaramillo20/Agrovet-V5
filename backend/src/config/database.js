import mongoose from 'mongoose'

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agrovet'
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  console.log(`MongoDB conectado: ${mongoose.connection.host}/${mongoose.connection.name}`)
}
