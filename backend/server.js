import express from 'express'
import cors from 'cors'

import db from './database.js'
import pollRoutes from './routes/polls.js'
import userRoutes from './routes/user.js'

const PORT = 8000
const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/polls', pollRoutes)
app.use('/api/users', userRoutes)


db.connect((err) => {
    if(err) {
        console.log('error in connecting to database', err)
    } else {
        console.log('connected to database')
    }
})

app.listen(PORT, () => {
    console.log(`server is running on ${PORT}`)
})