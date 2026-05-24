export const StaffInviteEmail = ({
    inviteUrl,
    restaurantName,
    role,
}: {
    inviteUrl: string;
    restaurantName: string;
    role: string;
}): string => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; line-height: 1.5; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Provision Access for ${restaurantName}</h1>
        <p>You have been sent a role-based access setup link for <strong>${restaurantName}</strong> as <strong>${role}</strong>.</p>
        <p>Open the link on the target device to complete setup:</p>
        <br/>
        <a href="${inviteUrl}" class="btn">Open Setup Link</a>
        <br/><br/>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        
        <div class="footer">
            <p>If you were not expecting this setup link, you can ignore this email.</p>
        </div>
    </div>
</body>
</html>
`;
