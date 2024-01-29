import express from 'express'
import { createPoll, fetchPollAnalytics, getAllPolls, updatePoll } from '../controllers/polls.js'

const router = express.Router()

router.post('/create', createPoll)
router.get('/all', getAllPolls)
router.put('/update/:pollId', updatePoll)
router.put('/update/:pollId/question-sets/:questionSetId', updatePoll)
router.get('/analytics/:pollId', fetchPollAnalytics)
router.get('/analytics/', fetchPollAnalytics)


export default router