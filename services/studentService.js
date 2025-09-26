// services/studentService.js - Fixed service with proper validation

const { Student } = require('../models/student');
const { Exposure } = require('../models');
const { parseCV } = require('../services/cvParsingService');
const fs = require('fs').promises;
const StudentUtils = require('../utils/studentUtils');
const { mapDegree, mapHours } = require('../utils/mappingUtils');

class StudentService {
    constructor() {
        this.chatSteps = StudentUtils.generateStepConfig();
    }


    async getProfileSummary(sessionId) {
        try {
            const student = await this.getBySessionId(sessionId);

            console.log('Getting profile summary for student:', {
                id: student._id,
                name: student.name,
                email: student.email,
                phone: student.phone,
                education: student.education,
                workExperience: student.workExperience,
                location: student.location,
                availability: student.availability,
                personalStatement: student.personalStatement?.substring(0, 50) + '...',
                additionalInfo: student.additionalInfo?.substring(0, 50) + '...',
                links: student.links,
                completionScore: StudentUtils.calculateCompletionScore(student)
            });

            return StudentUtils.sanitizeStudentData(student, true);
        } catch (error) {
            console.error('Failed to get profile summary:', error);
            throw new Error(`Failed to get profile: ${error.message}`);
        }
    }

    async validateStudentData(sessionId) {
        try {
            const student = await this.getBySessionId(sessionId);

            const validationReport = {
                hasBasicInfo: !!(student.name && student.email && student.phone),
                hasEducation: !!(student.education?.currentDegree && student.education?.institution),
                hasGPA: !!student.education?.gpa,
                hasWorkExperience: student.workExperience?.hasExperience !== undefined,
                hasLocation: !!student.location?.city,
                hasAvailability: !!student.availability?.hoursPerWeek,
                hasPersonalStatement: !!student.personalStatement,
                hasLinks: !!(student.links?.github || student.links?.linkedin || student.links?.portfolio),
                completionPercentage: StudentUtils.calculateCompletionScore(student)
            };

            console.log('Validation report for student:', validationReport);
            return validationReport;

        } catch (error) {
            console.error('Validation error:', error);
            throw error;
        }
    }

    async createSession(sessionId, initialData = {}) {
        try {
            // Always try to find existing session first
            let student = await Student.findOne({
                sessionId: sessionId
            });

            if (student) {
                // Reactivate existing session
                student.isActive = true;
                student.lastAccessed = new Date();
                await student.save();
                console.log('Reactivated existing session:', sessionId);
                return student;
            }

            // Create new session only if none exists
            student = new Student({
                name: initialData.name || '',
                email: initialData.email ? initialData.email.toLowerCase() : undefined,
                phone: initialData.phone || '',
                sessionId: sessionId,
                isActive: true
            });

            await student.save();
            console.log('Created new session:', sessionId);
            return student;
        } catch (error) {
            // If duplicate key error, try to find and return existing
            if (error.code === 11000) {
                const existing = await Student.findOne({ sessionId: sessionId });
                if (existing) {
                    existing.isActive = true;
                    existing.lastAccessed = new Date();
                    await existing.save();
                    return existing;
                }
            }
            throw new Error(`Failed to create session: ${error.message}`);
        }
    }


    async updateProfileFromChat(sessionId, profileData) {
        try {
            const student = await this.getBySessionId(sessionId);
            if (!student) {
                throw new Error('Session not found for profile update.');
            }

            console.log(`Updating profile for session ${sessionId}`);

            // Map data from frontend state to student schema
            student.name = StudentUtils.cleanTextInput(profileData.name, 100);
            student.email = profileData.email.toLowerCase();
            student.phone = StudentUtils.formatIsraeliPhone(profileData.phone);

            student.education.institution = profileData.institution;
            student.education.degreeField = profileData.major;
            student.education.currentDegree = mapDegree(profileData.degreeType);
            student.education.studyYear = profileData.year;
            student.education.gpa = parseFloat(profileData.gpa) || null;

            student.workExperience.hasExperience = profileData.experience !== 'אין';
            student.workExperience.description = profileData.experience;

            student.location.city = profileData.location;
            student.availability.hoursPerWeek = mapHours(profileData.hours);

            student.softSkills = profileData.softSkills;
            student.keyInfo = profileData.keyInfo;
            student.specialRoles = profileData.specialRoles;

            // A simple way to handle links, assuming one string
            if (profileData.links) {
                if (profileData.links.includes('github.com')) student.links.github = profileData.links;
                else if (profileData.links.includes('linkedin.com')) student.links.linkedin = profileData.links;
                else student.links.portfolio = profileData.links;
            }

            // Mark profile as complete
            student.profileComplete = true;
            student.termsAccepted = true;
            student.termsAcceptedDate = new Date();
            student.lastUpdated = new Date();

            await student.save();
            console.log('Student profile updated and finalized:', student._id);
            return student;

        } catch (error) {
            console.error('Failed to update profile from chat:', error);
            throw new Error(`Failed to update profile: ${error.message}`);
        }
    }

    async getBySessionId(sessionId) {
        try {
            const student = await Student.findOne({ sessionId: sessionId });
            if (!student) {
                throw new Error('Session not found');
            }
            return student;
        } catch (error) {
            throw new Error(`Failed to get student: ${error.message}`);
        }
    }

    getCurrentStepConfig(stepNumber) {
        return this.chatSteps[stepNumber] || null;
    }

    // תיקון הטיפול בפרופילים קיימים בעת העלאת CV
    async processCVUpload(sessionId, fileData, filename) {
        try {
            const student = await this.getBySessionId(sessionId);

            console.log('Processing CV upload for session:', sessionId);
            const parsedData = await parseCV(fileData, filename);
            console.log('CV parsing result:', parsedData);

            const cleanEmail = parsedData.email?.toLowerCase();

            // בדיקת משתמש קיים
            if (cleanEmail) {
                const existing = await this.checkExistingUser(cleanEmail, parsedData.phone);

                if (existing && existing.chatProgress.sessionId !== sessionId) {
                    console.log('Found existing user:', existing.name, existing.email);

                    // החזרת מידע על משתמש קיים - הלקוח יחליט מה לעשות
                    return {
                        student,
                        parsedData,
                        requiresConfirmation: true,
                        existingUser: {
                            id: existing._id,
                            name: existing.name,
                            email: existing.email,
                            completionPercentage: StudentUtils.calculateCompletionScore(existing)
                        },
                        message: `נמצא פרופיל קיים עבור ${existing.name} (${existing.email}). האם ברצונך לעדכן אותו או ליצור חדש?`
                    };
                }
            }

            // עדכון הסטודנט הנוכחי עם הנתונים החדשים
            const updates = {};
            if (parsedData.name && parsedData.name.trim()) {
                updates.name = StudentUtils.cleanTextInput(parsedData.name.trim(), 100);
            }
            if (parsedData.email && StudentUtils.isValidEmail(parsedData.email)) {
                updates.email = parsedData.email.toLowerCase();
            }
            if (parsedData.phone) {
                const cleanPhone = StudentUtils.formatIsraeliPhone(parsedData.phone);
                if (StudentUtils.isValidIsraeliPhone(cleanPhone)) {
                    updates.phone = cleanPhone;
                }
            }

            updates.cvFile = {
                filename,
                uploadDate: new Date()
            };

            Object.assign(student, updates);
            student.chatProgress.currentStep = 2;

            console.log('CV processed and student updated:', {
                name: student.name,
                email: student.email,
                phone: student.phone
            });

            return {
                student,
                parsedData: {
                    name: student.name,
                    email: student.email,
                    phone: student.phone
                },
                confidence: parsedData.confidence || {}
            };
        } catch (error) {
            console.error('CV processing error:', error);
            throw new Error(`Failed to process CV: ${error.message}`);
        }
    }

    // מתודה חדשה לטיפול בהחלפת פרופיל קיים
    async replaceExistingProfile(sessionId, existingUserId) {
        try {
            const currentStudent = await this.getBySessionId(sessionId);
            const existingStudent = await Student.findById(existingUserId);

            if (!existingStudent) {
                throw new Error('Existing user not found');
            }

            console.log('Replacing existing profile:', existingUserId, 'with session:', sessionId);

            // העברת נתונים מהפרופיל הקיים לנוכחי (אם יש)
            if (!currentStudent.name && existingStudent.name) {
                currentStudent.name = existingStudent.name;
            }
            if (!currentStudent.email && existingStudent.email) {
                currentStudent.email = existingStudent.email;
            }
            if (!currentStudent.phone && existingStudent.phone) {
                currentStudent.phone = existingStudent.phone;
            }

            // סימון הפרופיל הישן כמוחלף
            existingStudent.isActive = false;
            existingStudent.replacedBy = currentStudent._id;
            await existingStudent.save();

            // שמירת הפרופיל הנוכחי
            currentStudent.lastUpdated = new Date();
            await currentStudent.save();

            console.log('Profile replacement completed');

            return {
                success: true,
                message: 'הפרופיל הישן הוחלף בהצלחה. ממשיכים עם הפרופיל החדש.',
                student: currentStudent
            };

        } catch (error) {
            console.error('Failed to replace existing profile:', error);
            throw new Error(`Failed to replace profile: ${error.message}`);
        }
    }

    async processTranscriptUpload(sessionId, filename) {
        try {
            const student = await this.getBySessionId(sessionId);

            if (!student.education) student.education = {};
            student.education.transcriptFile = {
                filename,
                uploadDate: new Date()
            };
            student.markModified('education');

            await student.save();
            return student;
        } catch (error) {
            throw new Error(`Failed to process transcript: ${error.message}`);
        }
    }

    async verifyParsedData(sessionId, verificationData) {
        try {
            const student = await this.getBySessionId(sessionId);
            const { name, email, phone, isCorrect } = verificationData;

            if (!isCorrect) {
                if (name?.trim()) {
                    student.name = StudentUtils.cleanTextInput(name.trim(), 100);
                }
                if (email && StudentUtils.isValidEmail(email)) {
                    // שימוש במתודה הבטוחה לעדכון אימייל
                    try {
                        await student.updateEmail(email);
                    } catch (emailError) {
                        console.error('Email update failed:', emailError.message);
                        throw new Error('האימייל הזה כבר קיים במערכת');
                    }
                }
                if (phone?.trim()) {
                    const cleanPhone = StudentUtils.formatIsraeliPhone(phone.trim());
                    if (StudentUtils.isValidIsraeliPhone(cleanPhone)) {
                        student.phone = cleanPhone;
                    }
                }
            }

            await student.updateProgress(3);
            return student;
        } catch (error) {
            throw new Error(`Failed to verify data: ${error.message}`);
        }
    }

    async checkExistingUser(email, phone) {
        const query = {
            isActive: true
        };

        const conditions = [];
        if (email) conditions.push({ email: email.toLowerCase() });
        if (phone) conditions.push({ phone });

        if (conditions.length > 0) {
            query.$or = conditions;
            const existing = await Student.findOne(query);
            return existing;
        }

        return null;
    }

    // Admin functions remain the same
    async getStudentsList(filters = {}, anonymize = false, userId = null) {
        try {
            const {
                page = 1,
                limit = 20,
                search,
                completed,
                gpaMin,
                gpaMax,
                hasExperience,
                institution,
                degreeField,
                currentDegree,
                hoursPerWeek,
                studyYear,
                city,
                flexibleHours,
                favoritesOnly // New filter
            } = filters;

            const query = { isActive: true };

            if (favoritesOnly === 'true' && userId) {
                const { User } = require('../models');
                const user = await User.findById(userId).select('favoriteStudents');
                if (user) {
                    query._id = { $in: user.favoriteStudents };
                }
            }

            if (search) {
                const searchRegex = new RegExp(search, 'i');
                query.$or = [
                    { name: searchRegex },
                    { 'education.institution': searchRegex },
                    { 'education.degreeField': searchRegex },
                    { 'location.city': searchRegex }
                ];
            }

            if (completed === 'false') {
                query.profileComplete = false;
            } else if (completed !== 'all') {
                // Default to showing only completed profiles if filter is not 'all' or 'false'
                query.profileComplete = true;
            }
            if (gpaMin || gpaMax) {
                query['education.gpa'] = {};
                if (gpaMin) {
                    query['education.gpa'].$gte = parseFloat(gpaMin);
                }
                if (gpaMax) {
                    query['education.gpa'].$lte = parseFloat(gpaMax);
                }
            }
            if (hasExperience !== undefined) {
                query['workExperience.hasExperience'] = hasExperience === 'true';
            }
            if (institution) {
                query['education.institution'] = institution;
            }
            if (degreeField) {
                query['education.degreeField'] = degreeField;
            }
            if (currentDegree) {
                query['education.currentDegree'] = currentDegree;
            }
            if (hoursPerWeek) {
                query['availability.hoursPerWeek'] = hoursPerWeek;
            }
            if (studyYear) {
                query['education.studyYear'] = studyYear;
            }
            if (city) {
                query['location.city'] = new RegExp(city, 'i');
            }
            if (flexibleHours !== undefined) {
                query['availability.flexibleHours.available'] = flexibleHours === 'true';
            }


            const students = await Student.find(query)
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('-chatProgress.sessionId');

            const total = await Student.countDocuments(query);

            let processedStudents = students;
            if (anonymize && userId) {
                const userExposures = await Exposure.find({ userId: userId, isActive: true, expiresAt: { $gt: new Date() } }).select('studentId');
                const exposedStudentIds = new Set(userExposures.map(exp => exp.studentId.toString()));

                processedStudents = students.map(student => {
                    const hasAccess = exposedStudentIds.has(student._id.toString());
                    const anonymizedStudent = StudentUtils.anonymizeStudentForRecruiterView(student);
                    if (hasAccess) {
                        anonymizedStudent.name = student.name; // Restore the real name
                        anonymizedStudent.hasAccess = true; // Add a flag for the frontend
                    }
                    return anonymizedStudent;
                });
            } else if (anonymize) {
                processedStudents = students.map(student => StudentUtils.anonymizeStudentForRecruiterView(student));
            }

            return {
                students: processedStudents,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            };
        } catch (error) {
            throw new Error(`Failed to get students list: ${error.message}`);
        }
    }

    async getStudentById(id, anonymize = false) {
        try {
            const student = await Student.findById(id).select('-chatProgress.sessionId');
            if (!student) {
                throw new Error('Student not found');
            }
            return anonymize ? StudentUtils.anonymizeStudentForRecruiterView(student) : student;
        } catch (error) {
            throw new Error(`Failed to get student: ${error.message}`);
        }
    }

    async getStatistics() {
        try {
            const total = await Student.countDocuments({ isActive: true });
            const completed = await Student.countDocuments({
                isActive: true,
                profileComplete: true
            });

            const recentStudents = await Student.find({ isActive: true })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('name email createdAt');

            return {
                total,
                completed,
                inProgress: total - completed,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
                recentStudents: recentStudents.map(student => StudentUtils.sanitizeStudentData(student))
            };
        } catch (error) {
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }
}

module.exports = new StudentService();
