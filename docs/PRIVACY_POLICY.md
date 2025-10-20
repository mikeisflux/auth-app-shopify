# Privacy Policy for Collectible Tracker

**Effective Date:** [Insert Date]

## Introduction

This Privacy Policy describes how Collectible Tracker ("we", "our", or "the App") collects, uses, and protects information when you use our Shopify application.

## Information We Collect

### Merchant Information
When you install and use the App, we collect:
- **Shop Domain:** Your Shopify store URL
- **Access Tokens:** Encrypted tokens to interact with your store
- **Subscription Data:** Billing plan, payment status, and subscription history
- **Store Data:** Categories, collectible items, serial numbers, and images you create through the App

### Customer Information
When customers verify collectibles on your storefront:
- **IP Address:** Logged for fraud prevention and analytics
- **User Agent:** Browser and device information
- **Verification Timestamp:** Date and time of verification
- **Serial Number Entered:** The serial number being verified

**Note:** We do NOT collect customer names, email addresses, shipping addresses, or payment information.

## How We Use Information

### Merchant Data
- Provide and maintain the App's functionality
- Process subscription billing
- Store your collectible categories, items, and images
- Generate analytics and usage reports
- Communicate about service updates or support issues

### Customer Verification Data
- Track verification frequency for each collectible
- Prevent fraudulent verification attempts
- Improve the verification experience
- Generate aggregate analytics (no personal identification)

## Data Storage

### Image Storage
All images uploaded through the App are stored directly in **your Shopify Files**. We do not store images on external servers. This means:
- You maintain full control of your images
- Images are subject to Shopify's storage policies
- Deleting the App does not automatically delete images from your Shopify store

### Database Storage
We store app data in a secure AWS RDS PostgreSQL database:
- Encrypted at rest and in transit
- Regular automated backups
- Restricted access controls
- Located in [Your AWS Region]

## Data Sharing

We do NOT sell, trade, or rent your data to third parties.

We may share data only in these circumstances:
- **With Shopify:** As required for app functionality and billing
- **With AWS:** For secure database hosting
- **Legal Requirements:** If required by law, court order, or government request
- **Business Transfer:** In the event of a merger or acquisition (you will be notified)

## Data Retention

- **Active Merchants:** Data retained while subscription is active
- **Uninstalled App:** Data retained for 30 days for possible reinstallation
- **After 30 Days:** Automatic deletion of all merchant data
- **Verification Logs:** Retained for 12 months for analytics and fraud prevention

## GDPR Compliance

We comply with GDPR requirements:

### For Merchants (Data Controllers)
- You control what data is collected through the App
- You can export your data at any time
- You can delete your account and all data

### For Customers (Data Subjects)
- Customers can request their verification data
- Customers can request deletion of their verification logs
- We respond to requests within 30 days

### Shopify Webhook Handlers
We have implemented mandatory Shopify webhooks:
- `customers/data_request` - Handle customer data requests
- `customers/redact` - Delete customer data upon request
- `shop/redact` - Delete shop data after uninstallation

## Security Measures

We implement industry-standard security:
- **Encryption:** SSL/TLS for data in transit
- **Database Encryption:** AES-256 encryption at rest
- **Access Controls:** Role-based access restrictions
- **Regular Audits:** Security assessments and updates
- **Secure Tokens:** Encrypted storage of access tokens

## Your Rights

You have the right to:
- **Access:** Request a copy of your data
- **Correction:** Update inaccurate data
- **Deletion:** Request deletion of your account and data
- **Portability:** Export your data in a standard format
- **Object:** Object to certain data processing activities

To exercise these rights, contact us at [your-email@example.com].

## Cookies

The App uses essential cookies for:
- Session management
- Authentication
- Preventing CSRF attacks

We do NOT use tracking or advertising cookies.

## Children's Privacy

The App is not intended for users under 13 years of age. We do not knowingly collect data from children.

## Changes to Privacy Policy

We may update this policy periodically. Changes will be posted on this page with an updated "Effective Date." Continued use of the App after changes constitutes acceptance.

## Contact Us

For privacy questions or concerns:
- **Email:** [your-email@example.com]
- **Website:** [your-website.com]
- **Mail:** [Your Business Address]

## Compliance Certifications

- GDPR Compliant
- Shopify App Store Requirements
- AWS Security Standards

---

Last Updated: [Insert Date]