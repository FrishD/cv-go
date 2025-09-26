// middleware/studentSession.js - Fixed session validation and step handling
const { Student } = require('../models/student');
const StudentUtils = require('../utils/studentUtils');
const rateLimit = require('express-rate-limit');

const createOrGetSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json(
                StudentUtils.formatErrorResponse('Session ID is required', 400).response
            );
        }

        const student = await Student.findOne({
            sessionId: sessionId,
            isActive: true
        });

        if (!student) {
            return res.status(404).json(
                StudentUtils.formatErrorResponse('Session not found', 404).response
            );
        }

        req.student = student;
        next();
    } catch (error) {
        console.error('Session middleware error:', error);
        res.status(500).json(
            StudentUtils.formatErrorResponse('Session validation failed', 500).response
        );
    }
};

// Validate session exists and is active - FIXED: Allow same session resume
const validateSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json(
                StudentUtils.formatErrorResponse('Session ID is required', 400).response
            );
        }

        const student = await Student.findOne({
            sessionId: sessionId,
            isActive: true
        });

        if (!student) {
            return res.status(404).json(
                StudentUtils.formatErrorResponse('Session not found or expired', 404).response
            );
        }

        // Update last accessed time for active sessions
        student.lastAccessed = new Date();
        await student.save();

        req.student = student;
        next();
    } catch (error) {
        console.error('Session validation error:', error);
        res.status(500).json(
            StudentUtils.formatErrorResponse('Session validation failed', 500).response
        );
    }
};

// Spam protection for student chat
const spamProtection = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Increased to 15 requests per windowMs to allow for resume scenarios
    message: {
        success: false,
        error: 'Too many requests. Please wait before trying again.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use IP + user agent for rate limiting
        return StudentUtils.generateFingerprint(req);
    },
    skip: (req) => {
        // Skip rate limiting for completed sessions
        return req.student?.chatProgress?.completed === true;
    }
});

// File upload validation middleware
const validateFileUpload = (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json(
                StudentUtils.formatErrorResponse('No file uploaded', 400).response
            );
        }

        // Additional file validations
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png'
        ];

        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json(
                StudentUtils.formatErrorResponse('Invalid file type', 400).response
            );
        }

        // File size validation (10MB)
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json(
                StudentUtils.formatErrorResponse('File too large. Maximum size is 10MB', 400).response
            );
        }

        next();
    } catch (error) {
        console.error('File upload validation error:', error);
        res.status(500).json(
            StudentUtils.formatErrorResponse('File validation failed', 500).response
        );
    }
};

// Session cleanup middleware (for completed or expired sessions)
const sessionCleanup = async (req, res, next) => {
    try {
        // Clean up expired sessions (older than 48 hours) that haven't been accessed recently
        const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000);

        await Student.updateMany(
            {
                createdAt: { $lt: expiredTime },
                lastAccessed: { $lt: expiredTime }, // Also check last accessed time
                'chatProgress.completed': false,
                isActive: true
            },
            {
                $set: { isActive: false }
            }
        );

        next();
    } catch (error) {
        console.error('Session cleanup error:', error);
        // Don't fail the request if cleanup fails
        next();
    }
};

module.exports = {
    createOrGetSession,
    validateSession,
    spamProtection,
    validateFileUpload,
    sessionCleanup
};