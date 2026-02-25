# EmailJS Setup Instructions

To enable email sending directly from the demo booking form, you need to set up EmailJS.

## Step 1: Create EmailJS Account

1. Go to https://www.emailjs.com/
2. Sign up for a free account (free tier includes 200 emails/month)

## Step 2: Add Email Service

1. Go to **Email Services** in your EmailJS dashboard
2. Click **Add New Service**
3. Choose your email provider (Gmail recommended)
4. Follow the setup instructions to connect your email account
5. Copy the **Service ID** (you'll need this)

## Step 3: Create Email Template

1. Go to **Email Templates** in your EmailJS dashboard
2. Click **Create New Template**
3. Use this template structure:

**Subject:**
```
{{subject}}
```

**Content:**
```
{{message}}

---
This email was sent from the Zenith demo booking form.
```

4. Save the template and copy the **Template ID**

## Step 4: Get Public Key

1. Go to **Account** > **General** in your EmailJS dashboard
2. Find your **Public Key** and copy it

## Step 5: Configure Environment Variables

1. Create a `.env` file in the root of your project (copy from `.env.example`)
2. Add your EmailJS credentials:

```env
VITE_EMAILJS_SERVICE_ID=your_service_id_here
VITE_EMAILJS_TEMPLATE_ID=your_template_id_here
VITE_EMAILJS_PUBLIC_KEY=your_public_key_here
```

3. Restart your development server after adding the `.env` file

## Step 6: Test

1. Fill out the demo booking form
2. Submit it
3. Check `dwgrowthequity@gmail.com` for the email

## Project invite emails (Share tab)

To have **project invitations** sent **from** `katanatechnologysystems@gmail.com`:

1. In EmailJS, add an **Email Service** connected to Gmail and sign in with **katanatechnologysystems@gmail.com** (or use your existing service if it already uses that account).
2. Create an **Email Template** for invites with variables: `to_email`, `from_email`, `from_name`, `project_name`, `shareable_link`, `permission`, `subject`, `message`.
3. In `.env`, set:
   - `VITE_EMAILJS_INVITE_SERVICE_ID` = the Service ID for the service connected to katanatechnologysystems@gmail.com
   - `VITE_EMAILJS_INVITE_TEMPLATE_ID` = the Template ID for the invite template
   - `VITE_EMAILJS_PUBLIC_KEY` = your EmailJS public key (same as demo)

If the invite service/template are not set, the app falls back to the demo EmailJS service and template; the invite will still be added to the list but the "from" address will be whatever that service uses.

## Troubleshooting

- Make sure your `.env` file is in the root directory
- Restart the dev server after changing `.env` variables
- Check the browser console for any error messages
- Verify your EmailJS service is active and connected
- Make sure the template variables match: `to_email`, `from_name`, `from_email`, `company`, `phone`, `demo_date`, `demo_time`, `subject`, `message`
- For project invites: ensure the Email Service is connected to **katanatechnologysystems@gmail.com** so the invitation appears from that address
