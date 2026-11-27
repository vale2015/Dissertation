# Staff and booking chatbot workflow requirements

PM requirements received 27 November 2026 (two Mi Notes pages), transcribed for tracker items **#81** and **#82**. The [improvement tracker](IMPROVEMENT_TRACKER.md) holds status and evidence; this page holds the requirement detail. Items marked *Clarify* need a PM decision before implementation.

## #81 Staff registration, staff organisation and role-based access

### Workflow

- The chatbot runs the workflow. All information can be submitted in chat, and the bot elaborates it.
- All fields below are mandatory.
- The database is updated to hold the new information.
- At least one employee is created for each role type.
- All staff registration forms are updated. Every staff member carries all the information listed below.

### Role-based access

- Once registered, users are redirected according to the role the system assigns them.
- Advanced features are accessible only to the Management branch.

### Mandatory registration fields

**Personal information**
- Name
- Surname
- Date of birth
- Passport number
- House address (full address)

**Employment information**
- Position/role (from the staff organisation below)
- Start date
- Salary: hourly or fixed; Management roles are fixed
- Probation period

**Documents to upload**
- Passport
- Right to work (if needed)
- Tax number
- Employment contract, once signed
- CV

### New staff organisation

| Branch | Area | Roles |
|---|---|---|
| Front of house | Bar | Bartender, Bar Commis |
| Front of house | Restaurant | Supervisor, Waiter, Commis |
| Kitchen | — | Starters, Pizza, Dessert, Kitchen Porter, Pasta, Mains/Pass |
| Management | — | Owner, Restaurant Manager, Bar Manager, Head Chef |

### PM decisions (27 November 2026)

- **Duplicate role:** Management is the division; the second "Restaurant Manager" is the **Bar Manager**.
- **Redirects:** all roles land on the same page for now. Role-based access still controls what each role can use.
- **One employee per role:** create one person for each role and store them in the database. This is PM approval to create these 15 records (one per role) when #81 is implemented. Use clearly fictitious identity data (no real passport, tax or address details).
- **Priority:** Must, but not to be started now.

### Still open

1. **Advanced features:** which features count as Management-only? Today's permissions use the roles manager, supervisor and staff, and Supervisor sits under Front of house in the new organisation.
2. **"Right to work (if needed)":** what decides whether it is needed?
3. **Tax number:** is it a typed field, an uploaded document, or both?

### Original questions

1. **Duplicate role:** "Restaurant Manager" appears twice under Management. Is the second one a different role, for example Assistant Manager?
2. **Advanced features:** which features count as Management-only? Today's permissions use the roles manager, supervisor and staff. Note that Supervisor sits under Front of house in the new organisation.
3. **Role redirects:** which landing page does each branch or role go to after sign-in?
4. **"At least one employee per type":** should these be demonstration records, and in which environment? Creating records in production needs specific PM approval.
5. **"Right to work (if needed)":** what decides whether it is needed?
6. **Tax number:** is it a typed field, an uploaded document, or both?

### Safety dependencies (not scope changes)

- Passport numbers, dates of birth, addresses, tax numbers and identity documents are sensitive personal data. They need access restricted to Management, private storage for uploaded files (not public URLs), a retention rule, and audit of access and changes.
- Document uploads need file-type and size limits and malware-safe handling.
- Existing chatbot safeguards from #54/#69 still apply: review before submit, explicit confirmation, and retry-safe writes.
- Schema changes go through repository migrations replayed locally before any live apply (#3).

## #82 Booking creation workflow in the chatbot

### Workflow

- The bot creates the booking automatically once all required information is submitted in chat.
- The database is updated to hold the new information.

### Mandatory fields

All fields in this section are mandatory (PM decision, 27 November 2026), including time of booking and phone number.

- Name \*
- Surname \*
- Date of booking \*
- Time of booking
- Number of people \*
- Email \*
- Credit card details \*
- Phone number

### Optional fields

- Special occasion
- Special requests (allergies, dietary requirements); a free-text box
- Date of birth

### PM decisions (27 November 2026)

- **Time and phone:** mandatory, because they are listed under Mandatory fields.
- **Card details:** used for a **no-show charge**. The card must be saved through the payment provider for a later charge, not charged at booking.
- **Priority:** Must, but not to be started now.

### Still open

1. **Payment provider:** which provider should store the card for no-show charges (for example Stripe SetupIntent)?
2. **Confirmation:** should the bot ask for confirmation before creating the booking?
3. **No-show policy:** the charge amount, when a booking counts as a no-show, and who can trigger the charge.

### Original questions

1. **Time and phone:** are time of booking and phone number mandatory? They are listed under Mandatory fields without an asterisk.
2. **Card details:** what are they for (a deposit, a no-show guarantee or a charge), and which payment provider should be used?
3. **Confirmation:** should the bot ask for confirmation before creating the booking, as the staff workflow does, or submit as soon as all fields are present?

### Safety dependencies (not scope changes)

- **Card details must never be typed into chat, stored in the database or sent to the AI model.** Card collection must go through a PCI-compliant payment provider's hosted field or link, for example Stripe, and RFS keeps only the provider's token and status. Raw card numbers in a chat transcript would put the whole system in PCI DSS scope.
- Email, phone number, date of birth and allergy or dietary information are personal data. Dietary and allergy notes can reveal health information, which needs care under UK GDPR.
- Existing booking rules apply: the atomic booking and demand update (#1) and the booking permissions (`manage_bookings`).
