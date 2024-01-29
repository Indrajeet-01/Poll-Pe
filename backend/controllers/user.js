import db from "../database.js";

// fetch user polls and serve questions
export const fetchUserPollsAndServeQuestions = (req, res) => {
    const { userId } = req.params; // Get userId from request parameters
    const { startDate, endDate } = req.query;

    // Check if userId is provided
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // Query to fetch user's voting history
    const getUserVotingHistoryQuery = `
        SELECT DISTINCT question_sets.id AS questionSetID
        FROM votes
        JOIN question_sets ON votes.questionSetID = question_sets.id
        WHERE votes.userID = ?;
    `;

    // Execute the query to get user's voting history
    db.query(getUserVotingHistoryQuery, [userId], (err, votingHistoryResults) => {
        if (err) {
            console.error('Error fetching user voting history:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        const questionSetIdsAnswered = votingHistoryResults.map((result) => result.questionSetID);

        // Query to fetch polls and serve questions
        const fetchUserPollsAndServeQuestionsQuery = `
        SELECT DISTINCT polls.id AS pollID, question_sets.id AS questionSetID, question_sets.questionType, question_sets.questionText, question_sets.options
FROM polls
LEFT JOIN question_sets ON polls.id = question_sets.pollID
WHERE polls.startDate >= ? AND polls.endDate <= ? AND NOT EXISTS (
    SELECT 1
    FROM question_sets
    LEFT JOIN votes ON question_sets.id = votes.questionSetID
    WHERE votes.userID = ? AND votes.pollID = polls.id
    LIMIT 1
)
ORDER BY polls.id, question_sets.id;
        
        `;

        // Execute the query to fetch polls and serve questions
        db.query(fetchUserPollsAndServeQuestionsQuery, [startDate, endDate, userId], (err, results) => {
            if (err) {
                console.error('Error fetching user polls and serving questions:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            // Check if there are no new polls or unanswered questions
            if (results.length === 0) {
                return res.status(404).json({ message: 'No new polls exist' });
            }

            // Map the result to the desired response format
            const userPolls = [];
            let currentPollID = null;

            results.forEach((result) => {
                const { pollID, questionSetID, questionType, questionText, options } = result;

                if (currentPollID !== pollID) {
                    userPolls.push({
                        pollID,
                        questions: [],
                    });
                    currentPollID = pollID;
                }

                const userQuestion = {
                    questionSetID,
                    questionType,
                    questionText,
                    options: JSON.parse(options),
                };

                userPolls[userPolls.length - 1].questions.push(userQuestion);
            });

            return res.status(200).json({ userPolls });
        });
    });
};


// Submit a Poll
export const submitPoll = (req, res) => {
    const { userId } = req.params;
    const { pollId, questionSetId, selectedOption } = req.body;

    // Validate required parameters
    if (!userId || !pollId || !questionSetId || selectedOption === undefined) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    // Check if the user exists
    const checkUserQuery = 'SELECT id FROM users WHERE id = ?';
    db.query(checkUserQuery, [userId], (err, userResults) => {
        if (err) {
            console.error('Error checking user existence:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the specified question set exists for the given poll
        const checkQuestionSetQuery = 'SELECT * FROM question_sets WHERE id = ? AND pollID = ?';
        db.query(checkQuestionSetQuery, [questionSetId, pollId], (err, questionSetResults) => {
            if (err) {
                console.error('Error checking question set existence:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (questionSetResults.length === 0) {
                return res.status(404).json({ error: 'Question set not found for the specified poll' });
            }

            // Validate selected option
            const options = JSON.parse(questionSetResults[0].options);
            if (!options.includes(selectedOption)) {
                return res.status(400).json({ error: 'Invalid selected option for the question' });
            }

            // Calculate reward amount within the specified range
            const minReward = 10; // Replace with your actual minimum reward
            const maxReward = 50; // Replace with your actual maximum reward
            const rewardAmount = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;

            // Update user's data to indicate completion of the question
            const updateUserQuery = 'UPDATE users SET completedQuestionId = ?, completedPollId = ? WHERE id = ?';
            db.query(updateUserQuery, [questionSetId, pollId, userId], (err) => {
                if (err) {
                    console.error('Error updating user data:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                // Update poll analytics
                const updatePollAnalyticsQuery = `
        UPDATE poll_analytics
        SET totalVotes = totalVotes + 1,
            optionCounts = JSON_SET(optionCounts, ?, JSON_UNQUOTE(JSON_SET(optionCounts->'$', ?, JSON_EXTRACT(optionCounts->'$', ?) + 1)))
        WHERE pollId = ?;
    `;
                const optionPath = `$.${selectedOption}`;
                db.query(updatePollAnalyticsQuery, [optionPath, optionPath, optionPath, pollId], (err) => {
                    if (err) {
                        console.error('Error updating poll analytics:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    return res.status(200).json({ rewardAmount });
                });
            });
        });
    });
};
