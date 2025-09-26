const nodemailer = require("nodemailer")
const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
const rateLimit = require("express-rate-limit")

// Create the transporter with Gmail
const createTransporter = () => {
    return nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false, // STARTTLS
        auth: {
            user: process.env.CVGO_EMAIL || "noreply@cvgo.pro",
            pass: process.env.CVGO_PASS || "scvxyvnhfqgpcyfj", // סיסמה רגילה או App Password אם MFA פעיל
        },
        tls: {
            rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
    })
}

// Email-safe template generator
const createEmailTemplate = (title, successBadgeText, greeting, name, contentBody, ctaText, ctaUrl) => {
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    // Styles inspired by verify.html, adapted for email clients
    const bodyStyle = `font-family: 'Google Sans', 'Heebo', Arial, sans-serif; background-color: #0d0d0d; color: #ffffff; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;`;
    const wrapperStyle = `width: 100%; background-color: #0d0d0d; padding: 40px 20px;`;
    const containerStyle = `max-width: 600px; margin: 0 auto; background-color: #1c1c1e; border: 1px solid #3a3a3c; border-radius: 24px;`;
    const headerStyle = `padding: 40px 30px 30px; text-align: center; border-bottom: 1px solid #3a3a3c;`;
    const logoStyle = `height: 50px; width: auto; margin-bottom: 20px;`;
    const contentStyle = `padding: 40px 30px; color: #f2f2f7;`;
    const badgeStyle = `background-color: rgba(0, 122, 255, 0.15); color: #0091ff; padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; border: 1px solid rgba(0, 122, 255, 0.3);`;
    const greetingStyle = `color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 15px 0;`;
    const textStyle = `color: #c7c7cc; font-size: 16px; line-height: 1.6;`;
    const buttonStyle = `background-color: #007AFF; color: #FFFFFF; padding: 16px 32px; border-radius: 14px; font-size: 16px; font-weight: 600; text-decoration: none; display: inline-block;`;
    const footerStyle = `padding: 30px; text-align: center; border-top: 1px solid #3a3a3c; color: #8e8e93; font-size: 13px;`;

    return `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CVGO - ${title}</title>
            <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet" type="text/css">
            <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" type="text/css">
        </head>
        <body style="${bodyStyle}">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="${wrapperStyle}">
                <tr>
                    <td align="center">
                        <table width="600" border="0" cellspacing="0" cellpadding="0" style="${containerStyle}">
                            <!-- Header -->
                            <tr>
                                <td align="center" style="${headerStyle}">
                                    <img src="${baseUrl}/logo.png" alt="CVGO Logo" style="${logoStyle}" />
                                    <h1 style="color: #f2f2f7; font-size: 28px; font-weight: 700; margin: 0; font-family: 'Google Sans', 'Heebo', Arial, sans-serif;">CVGO</h1>
                                    <p style="color: #8e8e93; font-size: 13px; font-weight: 500; font-family: 'Google Sans', 'Heebo', Arial, sans-serif;">פלטפורמת גיוס מקצועית</p>
                                </td>
                            </tr>
                            <!-- Main Content -->
                            <tr>
                                <td style="${contentStyle}">
                                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                        <tr><td align="center" style="padding-bottom: 30px;"><span style="${badgeStyle}">${successBadgeText}</span></td></tr>
                                        <tr><td style="${greetingStyle}; font-family: 'Google Sans', 'Heebo', Arial, sans-serif;">${greeting} ${name},</td></tr>
                                        <tr><td style="${textStyle}; font-family: 'Google Sans', 'Heebo', Arial, sans-serif;">${contentBody}</td></tr>
                                        ${ctaUrl ? `<tr><td align="center" style="padding-top: 30px;"><a href="${ctaUrl}" target="_blank" style="${buttonStyle}">${ctaText}</a></td></tr>` : ""}
                                    </table>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td align="center" style="${footerStyle}">
                                    <p style="margin: 4px 0; font-family: 'Google Sans', 'Heebo', Arial, sans-serif;">© 2025 CVGO. כל הזכויות שמורות.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>`;
};

// Send agency verification request confirmation to user
const sendRegistrationConfirmation = async (user) => {
    try {
        const transporter = createTransporter()
        const ctaUrl = `${process.env.BASE_URL || "http://localhost:3000"}/dashboard.html`;

        const contentBody = `
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">תודה על בקשת האימות עבור סוכנות הגיוס שלך. הבקשה התקבלה בהצלחה ונמצאת בבדיקה.</p>
            <br>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2a2a2a; border-radius: 12px; padding: 20px; border: 1px solid #333333;">
                <tr><td style="font-size: 18px; font-weight: 600; color: #FFFFFF; padding-bottom: 15px; font-family: 'Heebo', Arial, sans-serif;">פרטי בקשת האימות</td></tr>
                <tr><td style="padding-top: 15px;">
                    <table border="0" cellpadding="5" cellspacing="0" width="100%">
                        <tr>
                            <td style="color: #AAAAAA; font-size: 14px; font-family: 'Heebo', Arial, sans-serif;">שם הסוכנות</td>
                            <td style="color: #FFFFFF; font-size: 14px; text-align: left; font-family: 'Heebo', Arial, sans-serif;">${user.companyName}</td>
                        </tr>
                        <tr>
                            <td style="color: #AAAAAA; font-size: 14px; font-family: 'Heebo', Arial, sans-serif;">איש קשר</td>
                            <td style="color: #FFFFFF; font-size: 14px; text-align: left; font-family: 'Heebo', Arial, sans-serif;">${user.fullName}</td>
                        </tr>
                        <tr>
                            <td style="color: #AAAAAA; font-size: 14px; font-family: 'Heebo', Arial, sans-serif;">תאריך הגשה</td>
                            <td style="color: #FFFFFF; font-size: 14px; text-align: left; font-family: 'Heebo', Arial, sans-serif;">${new Date().toLocaleDateString("he-IL")}</td>
                        </tr>
                    </table>
                </td></tr>
            </table>
            <br>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;"><strong>חשוב:</strong> ניתן כבר להשתמש ברוב התכונות של CVGO. אימות נדרש לגישה לפרופילי מועמדים ותכונות מתקדמות.</p>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">צוות האימות שלנו יבדוק את הפרטים תוך 48 שעות. תקבלו מייל נוסף עם השלמת התהליך.</p>
        `;

        const html = createEmailTemplate(
            "בקשת אימות סוכנות",
            "✓ בקשה התקבלה",
            "שלום",
            user.fullName,
            contentBody,
            "גישה למערכת CVGO",
            ctaUrl,
        )

        const result = await transporter.sendMail({
            from: process.env.CVGO_EMAIL || "noreply@cvgo.pro",
            to: user.email,
            subject: "בקשת אימות סוכנות התקבלה - CVGO",
            html: html,
        })

        console.log("Agency verification confirmation email sent:", result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error("Failed to send agency verification confirmation:", error)
        throw error
    }
}


// Send notification to admin about new agency verification request
const sendAdminNotification = async (user) => {
    try {
        const transporter = createTransporter()
        const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",") : ["admin@yourdomain.com"]
        const adminPanelUrl = `${process.env.BASE_URL || "http://localhost:3000"}/admin.html`;

        const contentBody = `
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">סוכנות גיוס חדשה solicitó la verificación y necesita una revisión administrativa.</p>
            <br>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2a2a2a; border-radius: 12px; padding: 20px; border: 1px solid #333333;">
                <tr><td style="font-size: 18px; font-weight: 600; color: #FFFFFF; padding-bottom: 15px; font-family: 'Heebo', Arial, sans-serif;">פרטי הסוכנות</td></tr>
                <tr><td style="padding-top: 15px;">
                    <table border="0" cellpadding="5" cellspacing="0" width="100%">
                        <tr><td style="color: #AAAAAA;">שם הסוכנות</td><td style="color: #FFFFFF; text-align: left;">${user.companyName}</td></tr>
                        <tr><td style="color: #AAAAAA;">איש קשר</td><td style="color: #FFFFFF; text-align: left;">${user.fullName}</td></tr>
                        <tr><td style="color: #AAAAAA;">אימייל</td><td style="color: #FFFFFF; text-align: left;">${user.email}</td></tr>
                        <tr><td style="color: #AAAAAA;">טלפון</td><td style="color: #FFFFFF; text-align: left;">${user.phone}</td></tr>
                        <tr><td style="color: #AAAAAA;">אזורי שירות</td><td style="color: #FFFFFF; text-align: left;">${user.regions.join(", ")}</td></tr>
                    </table>
                </td></tr>
            </table>
            <br>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;"><strong>תיאור הסוכנות:</strong> ${user.companyDescription}</p>
        `;


        const html = createEmailTemplate(
            "הודעת ניהול",
            "🔔 בקשה חדשה",
            "התראת ניהול:",
            "אימות סוכנות חדשה",
            contentBody,
            "בדיקה בלוח הניהול",
            adminPanelUrl
        )

        const emailPromises = adminEmails.map((email) => {
            return transporter.sendMail({
                from: process.env.CVGO_EMAIL || "noreply@cvgo.pro",
                to: email.trim(),
                subject: "🔔 בקשת אימות סוכנות חדשה - CVGO",
                html: html,
            })
        })

        await Promise.all(emailPromises)
        console.log("Admin notification sent successfully")
    } catch (error) {
        console.error("Failed to send admin notification:", error)
        throw error
    }
}

// Send verification success/failure email to user
const sendVerificationResultEmail = async (user, isApproved) => {
    const transporter = createTransporter()
    const dashboardUrl = `${process.env.BASE_URL || "http://localhost:3000"}/dashboard.html`;
    const supportEmail = process.env.SUPPORT_EMAIL || "support@cvgo.pro";

    let title, badgeText, greeting, contentBody, ctaText, ctaUrl;

    if (isApproved) {
        title = "אימות הסוכנות אושר";
        badgeText = "✓ אימות אושר";
        greeting = "ברכות";
        ctaText = "גישה לתכונות פרימיום";
        ctaUrl = dashboardUrl;
        contentBody = `
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">מזל טוב! סוכנות הגיוס שלך אומתה ואושרה לגישה מלאה ב-CVGO.</p>
            <br>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2a2a2a; border-radius: 12px; padding: 20px; border: 1px solid #333333;">
                <tr><td style="font-size: 18px; font-weight: 600; color: #FFFFFF; padding-bottom: 15px; font-family: 'Heebo', Arial, sans-serif;">גישת הפרימיום שלך כוללת</td></tr>
                <tr><td style="padding-top: 15px;">
                    <ul style="list-style-type: none; padding: 0; margin: 0; color: #FFFFFF;">
                        <li style="margin-bottom: 10px;">✓ פרופילי מועמדים מלאים</li>
                        <li style="margin-bottom: 10px;">✓ התאמת AI מתקדמת</li>
                        <li style="margin-bottom: 10px;">✓ יצירת קשר ישיר עם מועמדים</li>
                    </ul>
                </td></tr>
            </table>
            <br>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">ברוך הבא לקהילת הסוכנויות המאומתות של CVGO!</p>
        `;
    } else {
        title = "סטטוס אימות סוכנות";
        badgeText = "❌ נדרשת בדיקה";
        greeting = "שלום";
        ctaText = "צור קשר עם התמיכה";
        ctaUrl = `mailto:${supportEmail}`;
        contentBody = `
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">לאחר בדיקת בקשת האימות של הסוכנות שלך, לא הצלחנו לאשר אותה בשלב זה.</p>
            <br>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">אם אתה מאמין שזו טעות או אם יש לך מסמכים נוספים, אנא צור קשר עם צוות התמיכה שלנו.</p>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;"><strong>הערה:</strong> עדיין תוכל לגשת לתכונות הבסיסיות של CVGO.</p>
        `;
    }

    const html = createEmailTemplate(title, badgeText, greeting, user.fullName, contentBody, ctaText, ctaUrl);

    return transporter.sendMail({
        from: process.env.CVGO_EMAIL || "noreply@cvgo.pro",
        to: user.email,
        subject: title,
        html: html,
    });
};


// Send CV confirmation email
const sendConfirmationEmail = async (candidateData) => {
    try {
        const transporter = createTransporter()
        const { name, email, positions } = candidateData;
        const firstName = name.split(" ")[0];
        const profession = positions?.[0]?.title || "איש מקצוע";
        const dashboardUrl = `${process.env.BASE_URL || "http://localhost:3000"}/dashboard.html`;

        const contentBody = `
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">קורות החיים שלך עובדו והופצו בהצלחה לרשת השותפים המומחים שלנו לגיוס.</p>
            <br>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2a2a2a; border-radius: 12px; padding: 20px; border: 1px solid #333333;">
                <tr><td style="font-size: 18px; font-weight: 600; color: #FFFFFF; padding-bottom: 15px; font-family: 'Heebo', Arial, sans-serif;">סיכום ההפצה</td></tr>
                <tr><td style="padding-top: 15px;">
                    <table border="0" cellpadding="5" cellspacing="0" width="100%">
                        <tr>
                            <td style="color: #AAAAAA; font-size: 14px;">מקצוע</td>
                            <td style="color: #FFFFFF; font-size: 14px; text-align: left;">${profession}</td>
                        </tr>
                        <tr>
                            <td style="color: #AAAAAA; font-size: 14px;">תאריך עיבוד</td>
                            <td style="color: #FFFFFF; font-size: 14px; text-align: left;">${new Date().toLocaleString("he-IL")}</td>
                        </tr>
                    </table>
                </td></tr>
            </table>
            <br>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">הפרופיל שלך הותאם והופץ לסוכנויות גיוס מומחיות. אם ימצאו הזדמנויות מתאימות, הן ייצרו איתך קשר ישירות.</p>
        `;

        const html = createEmailTemplate(
            "הפצת קורות חיים",
            "✓ ההפצה הושלמה",
            "שלום",
            firstName,
            contentBody,
            "חקור הזדמנויות",
            dashboardUrl
        );

        const result = await transporter.sendMail({
            from: process.env.CVGO_EMAIL || "noreply@cvgo.pro",
            to: email,
            subject: "אישור הפצת קורות חיים - CVGO",
            html: html,
        });

        console.log("Email sent successfully:", result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error("Email sending failed:", error)
        return { success: false, error: error.message }
    }
}


// Send welcome email to regular users (non-recruitment agencies)
const sendUserWelcomeEmail = async (user) => {
    try {
        const transporter = createTransporter()
        const dashboardUrl = `${process.env.BASE_URL || "http://localhost:3000"}/dashboard.html`;

        const contentBody = `
           <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">ברוך הבא ל-CVGO! חשבונך נוצר בהצלחה ומוכן לשימוש.</p>
           <br>
           <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2a2a2a; border-radius: 12px; padding: 20px; border: 1px solid #333333;">
               <tr><td style="font-size: 18px; font-weight: 600; color: #FFFFFF; padding-bottom: 15px; font-family: 'Heebo', Arial, sans-serif;">פרטי חשבונך</td></tr>
               <tr><td style="padding-top: 15px;">
                   <table border="0" cellpadding="5" cellspacing="0" width="100%">
                       <tr><td style="color: #AAAAAA;">שם מלא</td><td style="color: #FFFFFF; text-align: left;">${user.fullName}</td></tr>
                       <tr><td style="color: #AAAAAA;">שם משתמש</td><td style="color: #FFFFFF; text-align: left;">${user.username}</td></tr>
                       <tr><td style="color: #AAAAAA;">סוג חשבון</td><td style="color: #FFFFFF; text-align: left;">משתמש רגיל</td></tr>
                   </table>
               </td></tr>
           </table>
           <br>
           <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">כעת יש לך גישה לתכונות הבסיסיות של CVGO. שדרוג לסוכנות מאומתת זמין דרך התמיכה.</p>
       `;

        const html = createEmailTemplate(
            "ברוך הבא ל-CVGO",
            "✓ החשבון נוצר",
            "ברוך הבא",
            user.fullName,
            contentBody,
            "גישה לפלטפורמת CVGO",
            dashboardUrl
        );

        const result = await transporter.sendMail({
            from: process.env.CVGO_EMAIL || "noreply@cvgo.pro",
            to: user.email,
            subject: "ברוך הבא ל-CVGO - החשבון נוצר",
            html: html,
        });

        console.log("User welcome email sent:", result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error("Failed to send user welcome email:", error)
        throw error
    }
}

// Send CV distribution email to recruitment agencies
const sendCVDistributionEmail = async (recruitmentEmail, candidateData, agency) => {
    try {
        const transporter = createTransporter()
        const contactUrl = `mailto:${candidateData.email}?subject=Job Opportunity - ${candidateData.requestedPositions}&body=Hello ${candidateData.name.split(" ")[0]}, I represent ${agency.companyName} recruitment agency...`;

        const contentBody = `
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">איש גיוס יקר,</p>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">יש לנו מועמד חדש שתואם את אזור השירות שלך ועשוי לעניין את סוכנותך.</p>
            <br>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2a2a2a; border-radius: 12px; padding: 20px; border: 1px solid #333333;">
                <tr><td style="font-size: 18px; font-weight: 600; color: #FFFFFF; padding-bottom: 15px; font-family: 'Heebo', Arial, sans-serif;">פרופיל המועמד</td></tr>
                <tr><td style="padding-top: 15px;">
                    <table border="0" cellpadding="5" cellspacing="0" width="100%">
                        <tr><td style="color: #AAAAAA;">שם מלא</td><td style="color: #FFFFFF; text-align: left;">${candidateData.name}</td></tr>
                        <tr><td style="color: #AAAAAA;">טלפון</td><td style="color: #FFFFFF; text-align: left;">${candidateData.phone}</td></tr>
                        <tr><td style="color: #AAAAAA;">אימייל</td><td style="color: #FFFFFF; text-align: left;">${candidateData.email}</td></tr>
                        <tr><td style="color: #AAAAAA;">ניסיון</td><td style="color: #FFFFFF; text-align: left;">${candidateData.experienceYears} שנים</td></tr>
                        <tr><td style="color: #AAAAAA;">משרות מבוקשות</td><td style="color: #FFFFFF; text-align: left;">${candidateData.requestedPositions}</td></tr>
                        <tr><td style="color: #AAAAAA;">אזור מועדף</td><td style="color: #FFFFFF; text-align: left;">${candidateData.region}</td></tr>
                    </table>
                </td></tr>
            </table>
            <br>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">אם הפרופיל מתאים, אנא צור קשר ישיר עם המועמד.</p>
        `;

        const html = createEmailTemplate(
            "התאמת מועמד חדש",
            "🎯 התראת מועמד",
            "שלום",
            `צוות הגיוס של ${agency.companyName}`,
            contentBody,
            "צור קשר עם המועמד",
            contactUrl
        );

        const result = await transporter.sendMail({
            from: process.env.CVGO_EMAIL || "noreply@cvgo.pro",
            to: recruitmentEmail,
            subject: `התראת מועמד חדש - ${candidateData.name}`,
            html: html,
            headers: {
                "X-Priority": "3",
                "X-Candidate-ID": candidateData.candidateId,
                "X-Agency-ID": agency._id,
            },
        });

        console.log(`CV distribution email sent to ${recruitmentEmail}:`, result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error(`Failed to send CV distribution to ${recruitmentEmail}:`, error)
        throw error
    }
}

// Test distribution system
const sendDistributionTestEmail = async (testEmail, agencyInfo) => {
    try {
        const transporter = createTransporter()
        const dashboardUrl = `${process.env.BASE_URL || "http://localhost:3000"}/dashboard.html`;
        const mockCandidate = {
            name: "ישראל ישראלי",
            phone: "050-123-4567",
            email: "test@example.com",
            previousJob: "מפתח תוכנה Senior",
            experienceYears: "5",
            requestedPositions: "Full Stack Developer, Backend Developer, Team Lead",
            region: "מרכז",
        };

        const contentBody = `
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;"><strong>🧪 אימייל בדיקה - מערכת הפצת קורות חיים</strong></p>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">זהו אימייל בדיקה כדי לוודא שמערכת הפצת קורות החיים שלך פועלת כראוי.</p>
            <br>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2a2a2a; border-radius: 12px; padding: 20px; border: 1px solid #333333;">
                <tr><td style="font-size: 18px; font-weight: 600; color: #FFFFFF; padding-bottom: 15px; font-family: 'Heebo', Arial, sans-serif;">פרופיל מועמד לדוגמה</td></tr>
                <tr><td style="padding-top: 15px;">
                    <table border="0" cellpadding="5" cellspacing="0" width="100%">
                        <tr><td style="color: #AAAAAA;">שם</td><td style="color: #FFFFFF; text-align: left;">${mockCandidate.name}</td></tr>
                        <tr><td style="color: #AAAAAA;">טלפון</td><td style="color: #FFFFFF; text-align: left;">${mockCandidate.phone}</td></tr>
                        <tr><td style="color: #AAAAAA;">אימייל</td><td style="color: #FFFFFF; text-align: left;">${mockCandidate.email}</td></tr>
                        <tr><td style="color: #AAAAAA;">ניסיון</td><td style="color: #FFFFFF; text-align: left;">${mockCandidate.experienceYears} שנים</td></tr>
                    </table>
                </td></tr>
            </table>
            <br>
            <p style="color: #DDDDDD; font-size: 16px; line-height: 1.6;">כאשר מועמדים אמיתיים יגישו את קורות החיים שלהם, תקבלו אימיילים דומים עם פרטיהם.</p>
        `;

        const html = createEmailTemplate(
            "בדיקת מערכת הפצה",
            "🧪 הודעת בדיקה",
            "שלום",
            `צוות הגיוס של ${agencyInfo.companyName}`,
            contentBody,
            "גישה ללוח המחוונים",
            dashboardUrl
        );

        const result = await transporter.sendMail({
            from: process.env.CVGO_EMAIL || "noreply@cvgo.pro",
            to: testEmail,
            subject: "🧪 בדיקה - מערכת הפצת קורות חיים של CVGO",
            html: html,
            headers: {
                "X-Priority": "3",
                "X-Test-Email": "true",
            },
        });

        console.log(`Test distribution email sent to ${testEmail}:`, result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error(`Failed to send test distribution email:`, error)
        throw error
    }
}

module.exports = {
    sendConfirmationEmail,
    sendAdminNotification,
    sendUserWelcomeEmail,
    sendVerificationResultEmail,
    sendRegistrationConfirmation,
    sendCVDistributionEmail,
    sendDistributionTestEmail,
}