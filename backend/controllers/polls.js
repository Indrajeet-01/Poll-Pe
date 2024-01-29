import db from "../database.js";

// create poll
export const createPoll = (req, res) => {
    const {
        title,
        category,
        startDate,
        endDate,
        minReward,
        maxReward,
        questionSets,
    } = req.body;

    if (!title || !category || !startDate || !endDate || !minReward || !maxReward || !Array.isArray(questionSets)) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    const createPollQuery = 'INSERT INTO polls (title, category, startDate, endDate, minReward, maxReward) VALUES (?, ?, ?, ?, ?, ?)';

    db.query(
        createPollQuery,
        [title, category, startDate, endDate, minReward, maxReward],
        (err, results) => {
            if (err) {
                console.error('Error in poll query:', err); // Log the error for debugging
                return res.status(500).json({ error: 'Internal server error' });
            }

            const pollID = results.insertId;

            const addQuestionSetQuery = 'INSERT INTO question_sets (pollID, questionType, questionText, options) VALUES (?, ?, ?, ?)';

            questionSets.forEach(({ questionType, questionText, options }) => {
                const questionSetsValues = [pollID, questionType, questionText, JSON.stringify(options)];
    
                db.query(addQuestionSetQuery, questionSetsValues, (err) => {
                    if (err) {
                        console.error('Error in question query:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }
                });
            });

            return res.status(201).json({ message: 'Poll is created successfully' }); 
        }
    );
};

// fetch all polls
export const getAllPolls = (req, res) => {
    // pagination parameters
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    
    const offset = (page - 1) * pageSize;

    // query to fetch all polls with additional information
    const getAllPollsQuery = `
        SELECT
            polls.id AS pollID,
            polls.title AS pollTitle,
            polls.category AS pollCategory,
            polls.startDate,
            polls.endDate,
            COUNT(DISTINCT votes.userID) AS totalVotes,
            COUNT(DISTINCT question_sets.id) AS numberOfQuestionSets,
            MIN(question_sets.id) AS sampleQuestionSetID,
            MIN(question_sets.questionType) AS sampleQuestionType,
            MIN(question_sets.questionText) AS sampleQuestionText,
            MIN(question_sets.options) AS sampleOptions
        FROM polls
        LEFT JOIN question_sets ON polls.id = question_sets.pollID
        LEFT JOIN votes ON question_sets.id = votes.questionSetID
        GROUP BY polls.id
        ORDER BY polls.id DESC
        LIMIT ?, ?;
    `;

    db.query(getAllPollsQuery, [offset, pageSize], (err, results) => {
        if (err) {
            console.error('Error fetching all polls:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Check if there are no polls
        if (results.length === 0) {
            return res.status(404).json({ error: 'No polls found' });
        }

        
        const polls = results.map((result) => ({
            pollID: result.pollID,
            pollTitle: result.pollTitle,
            pollCategory: result.pollCategory,
            startDate: result.startDate,
            endDate: result.endDate,
            totalVotes: result.totalVotes,
            numberOfQuestionSets: result.numberOfQuestionSets,
            sampleQuestion: {
                questionSetID: result.sampleQuestionSetID,
                questionType: result.sampleQuestionType,
                questionText: result.sampleQuestionText,
                options: JSON.parse(result.sampleOptions),
            },
        }));

        return res.status(200).json({ polls, page, pageSize });
    });
};

// update poll and associated questionset
export const updatePoll = (req, res) => {
    const { pollId } = req.params; 
    const { title, category, minReward, maxReward, startDate, endDate, questionSets } = req.body;

    
    if (!pollId) {
        return res.status(400).json({ error: 'Poll ID is required' });
    }

    // update query for poll details
    const updatePollDetailsQuery = `
        UPDATE polls
        SET title = ?, category = ?, minReward = ?, maxReward = ?, startDate = ?, endDate = ?
        WHERE id = ?;
    `;

    
    db.query(
        updatePollDetailsQuery,
        [title, category, minReward, maxReward, startDate, endDate, pollId],
        (err, results) => {
            if (err) {
                console.error('Error updating poll details:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            
            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'Poll not found' });
            }

            // update question sets if provided
            if (questionSets && questionSets.length > 0) {
                // Iterate through each question set and update
                questionSets.forEach(({ questionSetId, questionText, options, questionType }) => {
                    const updateQuestionSetQuery = `
                        UPDATE question_sets
                        SET questionText = ?, options = ?, questionType = ?
                        WHERE id = ? AND pollID = ?;
                    `;

                    // update query for each question set
                    db.query(
                        updateQuestionSetQuery,
                        [questionText, JSON.stringify(options), questionType, questionSetId, pollId],
                        (err, results) => {
                            if (err) {
                                console.error('Error updating question set:', err);
                                return res.status(500).json({ error: 'Internal server error' });
                            }
                        }
                    );
                });
            }

            return res.status(200).json({ message: 'Poll updated successfully' });
        }
    );
};

// fetch poll Analytics for a particular poll
export const fetchPollAnalytics = (req, res) => {
    const { pollId } = req.params;

    
    if (!pollId) {
        return res.status(400).json({ error: 'Poll ID is required' });
    }

    const fetchPollAnalyticsQuery = `
        SELECT totalVotes, optionCounts
        FROM poll_analytics
        WHERE pollId = ?;
    `;

    //  query to fetch poll analytics
    db.query(fetchPollAnalyticsQuery, [pollId], (err, results) => {
        if (err) {
            console.error('Error fetching poll analytics:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // check if the poll analytics data is available
        if (results.length === 0) {
            return res.status(404).json({ error: 'Poll analytics not found for the specified poll' });
        }

        // extract the data from the result
        const { totalVotes, optionCounts } = results[0];

        // Provide the response with the requested poll analytics
        return res.status(200).json({ pollId, totalVotes, optionCounts });
    });
};

// fetch Overall Poll Analytics
export const fetchOverallPollAnalytics = (req, res) => {
    // Query to fetch overall poll analytics
    const fetchOverallPollAnalyticsQuery = `
        SELECT COALESCE(SUM(totalVotes), 0) AS overallTotalVotes, JSON_OBJECTAGG(CAST(pollId AS CHAR), optionCounts) AS overallOptionCounts
        FROM poll_analytics;
    `;

    // Execute the query to fetch overall poll analytics
    db.query(fetchOverallPollAnalyticsQuery, (err, results) => {
        if (err) {
            console.error('Error fetching overall poll analytics:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Extract the data from the result
        const { overallTotalVotes, overallOptionCounts } = results[0];

        // Provide the response with the overall poll analytics
        return res.status(200).json({ overallTotalVotes, overallOptionCounts });
    });
};
