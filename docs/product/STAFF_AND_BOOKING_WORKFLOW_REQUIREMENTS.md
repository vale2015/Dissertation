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
| Management | — | Owner, Restaurant Manager, Restaurant Manager (listed twice), Head Chef |

### Clarify

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

The PM's note marks the starred fields as mandatory. Time of booking and phone number are listed under Mandatory fields but are not starred (*Clarify*).

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

### Clarify

1. **Time and phone:** are time of booking and phone number mandatory? They are listed under Mandatory fields without an asterisk.
2. **Card details:** what are they for (a deposit, a no-show guarantee or a charge), and which payment provider should be used?
3. **Confirmation:** should the bot ask for confirmation before creating the booking, as the staff workflow does, or submit as soon as all fields are present?

### Safety dependencies (not scope changes)

- **Card details must never be typed into chat, stored in the database or sent to the AI model.** Card collection must go through a PCI-compliant payment provider's hosted field or link, for example Stripe, and RFS keeps only the provider's token and status. Raw card numbers in a chat transcript would put the whole system in PCI DSS scope.
- Email, phone number, date of birth and allergy or dietary information are personal data. Dietary and allergy notes can reveal health information, which needs care under UK GDPR.
- Existing booking rules apply: the atomic booking and demand update (#1) and the booking permissions (`manage_bookings`).
