import express from 'express'
import { fetchUserPollsAndServeQuestions, submitPoll } from '../controllers/user.js'


const router = express.Router()

router.get('/:userId/polls', fetchUserPollsAndServeQuestions)
router.post('/:userId/submit-poll', submitPoll)

export default router