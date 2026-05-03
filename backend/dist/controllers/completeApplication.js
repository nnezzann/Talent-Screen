import Applicant from "../models/Applicant.js";
import { sendMailIfConfigured } from "../lib/mailer.js";
import { buildShortlistedApplicantEmail, buildRejectedApplicantEmail } from "../lib/emailTemplates.js";
const completeApplication = async (req, res) => {
    try {
        const { selected_applicants_str } = req.body;
        let selected_applicants = JSON.parse(selected_applicants_str);
        for (const selected_applicant of selected_applicants) {
            let first_name = selected_applicant.first_name;
            let last_name = selected_applicant.last_name;
            let email = selected_applicant.email;
            const applicant = await Applicant.findOne({
                first_name,
                last_name,
                email,
            });
            if (!applicant) {
                return res.status(404).json({ data_error: "Applicant not registered" });
            }
            applicant.applicant_state = "Shortlisted";
            await applicant.save();
            const emailPayload = buildShortlistedApplicantEmail({
                applicantName: `${applicant.first_name} ${applicant.last_name}`,
                jobTitle: applicant.job_title || "the role",
            });
            await sendMailIfConfigured({
                to: email,
                subject: emailPayload.subject,
                text: emailPayload.text,
                html: emailPayload.html,
            });
        }
        const rejected_applicants = await Applicant.find({
            applicant_state: "Rejected",
        });
        for (const applicant of rejected_applicants) {
            if (applicant.email) {
                const emailPayload = buildRejectedApplicantEmail({
                    applicantName: `${applicant.first_name} ${applicant.last_name}`,
                    jobTitle: applicant.job_title || "the role",
                });
                await sendMailIfConfigured({
                    to: applicant.email,
                    subject: emailPayload.subject,
                    text: emailPayload.text,
                    html: emailPayload.html,
                });
            }
        }
        await Applicant.deleteMany({
            applicant_state: "Rejected",
        });
        return res.status(200).json({ success: "Applications completed successfully" });
    }
    catch (error) {
        console.error("Error in completeApplication:", error);
        return res.status(500).json({ server_error: "Internal server error" });
    }
};
export default completeApplication;
//# sourceMappingURL=completeApplication.js.map