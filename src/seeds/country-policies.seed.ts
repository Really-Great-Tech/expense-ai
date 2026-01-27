/**
 * Country Policy Seed Data
 *
 * This file contains seed data for country expense policies using the
 * markdown-based context stuffing architecture.
 *
 * Policies are stored as full markdown documents with page markers ([[PAGE_X]])
 * for citation and verification purposes.
 *
 * Use the policy ingestion endpoint (POST /api/country-policy/ingest) to
 * populate this data from PDF/DOCX policy documents.
 */

export interface PolicyMetadata {
  title?: string;
  effectiveDate?: string;
  version?: string;
  sourceFile?: string;
  parsedDate?: string;
  parserUsed?: string;
}

export interface CountryPolicySeed {
  name: string;           // Country name
  code?: string;          // ISO country code (e.g., "AT", "US")
  policyMarkdown: string; // Full policy document with [[PAGE_X]] markers
  pageCount: number;      // Number of pages in the source document
  icps: string[];         // ICP identifiers in the document
  metadata: PolicyMetadata;
}

/**
 * Country policy seeds - populated via the policy ingestion pipeline.
 * 
 * Example structure:
 * ```typescript
 * "Austria": {
 *   name: "Austria",
 *   code: "AT",
 *   policyMarkdown: "[[PAGE_1]]\n# Expense Policy\n\nIntroduction...\n\n[[PAGE_2]]\n# Receipt Requirements\n...",
 *   pageCount: 6,
 *   icps: ["Global People IT-Services GmbH"],
 *   metadata: {
 *     title: "Austria Expense Policy",
 *     effectiveDate: "2024-01-01",
 *     version: "1.0",
 *     sourceFile: "austria_expense_policy.pdf",
 *     parsedDate: "2024-01-25T10:30:00Z",
 *     parserUsed: "Textract"
 *   }
 * }
 * ```
 */
export const COUNTRY_POLICY_SEEDS: Record<string, CountryPolicySeed> = {

  "Indonesia": {
    "name": "Indonesia",
    "code": "ID",
    "policyMarkdown": `

## Page 1

GoGlobal
Expenses Claim
Guidelines - Indonesia
January 2024
This document provides guidelines to
GoGlobal workers on submitting expense
claims compliantly

## Page 2

Roles and Responsibilities
Employee
Client
GoGlobal
To whom the employee is
Individuals hired by GoGlobal
Employer of Record
dispatched or assigned
Obtain the valid and correct receipts
Review the submitted expenses to ensure
Validate the receipts submitted by the
that have all the correct and needed
Establish clear business purpose of all
employee according to local regulations.
information and have a clear business
incurred expenses
Follow up on missing or questionable
purpose.
Submit expense claims with clear and
receipts, postpone or reject
Share with GoGlobal, the approved
legible copies of the receipts to Client
reimbursements if required for
expenses per worker before the payroll cut
line manager for approval preferably
compliance and taxability.
off date to process them in the same month.
within the same month of the expense.
Settle reimbursement based on the
The expense submission must have an
Be compliant with the local guidelines.
itemized report along with clear receipts
approved expense submission by the
client and verified receipts.
2
GoGlobal

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |


## Page 3

Option 1: Employees using GoGlobal's Expenses System (Zoho)
Preferred and most common choice
Employees submit the
Client line manager
GoGlobal fetches the
expenses in the Zoho
reviews and approves
approved expenses from
system along with
the expenses by the
expenses system,
properly labelled
monthly payroll cutoff
performs a thorough
receipts.
date.
review and processes all
valid expenses.
Step 1
Step 2
Step 3
Please Note:
This is the preferred mode and ensures timely expense processing.
Client does not upload expenses into GoGlobal's system (BlueOcean), GoGlobal does it on their behalf.
3
The expenses approved after the payroll cutoff date are processed in the following month.
GoGlobal

|  |  |  |  |  |
| --- | --- | --- | --- | --- |


## Page 4

Option 2: Employees using Client's Expenses System or GoGlobal's
Expense template
Not a preferred option but accepted
Employees submit the
Client line manager
Client uploads the
GoGlobal reviews the
expenses along with
reviews and approves the
approved expenses with
submitted expenses and
properly labeled receipts
expenses.
itemized expense reports
processes all valid
or GoGlobal's Expense
expenses.
to the Client for approval.
Template to BlueOcean
payroll instructions along
with expenses receipts.
Step 1
Step 2
Step 3
Step 4
Please Note:
Expenses submitted without itemized reports or properly labeled receipts will be rejected or postponed.
4
The expenses submitted after the payroll cutoff date are processed in the following month.
GoGlobal

|  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |


## Page 5

What comprises a clear expense submission
Clear and legible
Convert amount in
For Mileage
receipts, with total
local currency and
reimbursements,
Include details (date
Correct
amount matching the
Include currency &
include To and Fro
of expense, business
categorization of the
receipts, labeled
exchange rate used
locations, distance
purpose, and
incurred expense
properly for
for foreign currency
travelled and per diem
merchant name)
identification.
expenses
rates.
Please note that GoGlobal only reimburses the clear expense submission that are approved by the Client. GoGlobal holds the right to reject or postpone
payments if the expenses submissions do not follow the above listed criteria or are submitted post the payroll cutoff shared with the Client.
5
GoGlobal

|  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |


## Page 6

Expense Categories
Accepted Expenses
Non-reimbursable Expenses
Travel expenses (including Baggage claim, meals
Expenses for spouses, partners, and other family
and accommodation)
members.
Work-related supplies (e.g., stationery, photocopy)
Personal expenses (any non-business-related
Work related equipment
expenses).
Dues, subscriptions, and professional licenses
Expenses without suitable invoice/receipt or
supporting document are illegible.
Shipping & postage
Any casual emolument or benefit attached to an
Transportation for business (Taxi, Grab, Train,
office or position in addition to salary or wages,
Airfare) - mileage report
(e.g., salary of house help, gas, water, or electricity
Client or customer visits
bills, school fees, personal travel.)
Training and development
Conference and business events
Expenses that fall under taxable income will be treated as per the local regulations.
6
GoGlobal

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |


## Page 7

Expense Benefits In Kind (BIK)
BIKs (Taxable)
Non-BIKs (Non-Taxable)
Reimbursement of airfare ticket for personal trip (e.g.., expatriate
Reimbursement of airfare ticket for business trip
employee, as per employment contract - round trip ticket to home
country, provided by the employer)
Business lunch/ entertainment with client/ prospect
client/vendor
Mobile phone bills/credit; internet billing
Reimbursement of purchasing the office supplies
Personal Meals during business trip
Reimbursement of car rental used during business
Car rental dedicated for employee and the car is parked at the
trip
employee's home (not parked in the office)
Reimbursement of trainings
Reimbursement of fuel and toll from the car rental or on private car
used.
Meals and drinks ingredient, and/or drinks provided
for all employees
Reimbursement of medical claims personal
Transportation facility provided for all employees
Medical insurance premium (additional insurance provided to
employee and his/her family on top of the mandatory benefit by
Reimbursement of taxi for visiting client office,
regulation)
government/tax office (for business purpose)
House rental provided to employee
Uniform which is not related with work and safety requirement
Child's tuition fee borne by company (e.g., for expatriate employee
7
GoGlobal

## Page 8

Receipt Requirements
TAWAN
MALL KUNINGAN CITY
Address:
Lantai UG No 50 - 50A
Agoda Company Pte, Ltd.
TELP (021)-2992 1879
30 Cecil Street
Prudential Tower #19-08
JAKARTA
Singapore 049712
Components of an expense receipt
POS: cashier
Cashier: Noviana
Booking No.
Print Cnt:1
Payment Date July 20, 2023
Server: TABSQUARE
Receipt
Date of the Expense
Dec 27, 2023 3:12:39 PM
PAX: 3
Customer Name & Address
TBL 24
Guest
Name
NAME
Phone:
Billing Address
Expense type / Description
REF: TABSQUARE: 707518985
Email Address
1 Mie Goreng Spesial Ulang Tahun
42,000
1 Jamur Enoki Goreng Garing (DITA)
42,000
Description
Amount
1 Bayam Jepang Tiga Telur (DITA)
60,000
Total Amount of the expense
1 Bubur Polos (DITA)
22,000
Hotel Name
Hotel Kuretakeso Kemang
1 Teh Madu Dengan Goji Berry Dan L
42,000
Period
July 20, 2023 July 21, 2023 night(s)
1 Ayam Rebus Hainan 1 Ekor (DITA)
120,000
1 Cakue (DITA)
12,000
Room Type
Executive King Room
Name of the Vendor / Merchant
1 Take Away Charge
4,545
# of Rms.
1
Total Item : 8
Total Qty : 8
# of Extra Beds
0
Subtotal
Total Room Charges
USD 42.23
VAT amount, listed clearly on the Invoice (if applicable)
344,545
Service charge
18,950
Total Extra Bed Charges
USD 0.00
Tax Resto 10%
36,349
Total
Discount
USD-1.75
399,844
Name of clients/vendor in the expense report for business
GRAND TOTAL
USD 40.48
meal with clients/vendor*
Printed Dec 27, 2023 3:44:17 PM
Total Charge
IDR 602,933 (USD 40.48)
8
GoGlobal

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |


|  |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |


|  |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |


|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |


## Page 9

What can delay/ reject reimbursements?
$
$
!
€
If the expense
If one or more of the
If the business
Exchange rates
Submissions do not
receipts total do not
receipts are invalid
purpose of expenses
and/or exchange
follow the format
match the submitted
or unreadable.
cannot be
currency missing for
advised by GoGlobal
expense amount.
established or they
expenses incurred in
fall under a taxable
foreign currency
allowance/personal
expense.
9
GoGlobal

## Page 10

GoGlobal
Thank You`,
    "pageCount": 1,
    "icps": [
      "GoGlobal"
    ],
    "metadata": {
      "title": "Indonesia",
      "version": "1",
      "parsedDate": "2026-01-25T15:47:40.189Z",
      "parserUsed": "Textract",
      "sourceFile": "Indonesia-Expense-Claim-Guidelines.pdf",
      "effectiveDate": "2026-01-25T15:22:31Z"
    }
  },
  "Germany": {
    "name": "Germany",
    "code": "DE",
    "policyMarkdown": `

## Page 1

Introduction
An expense reimbursement process allows you to reimburse your workers for situations where
they have used their own funds to cover business related items.
Expense reimbursement rules, taxation laws and claims process vary greatly under each
country's employment legislation and company policies. It is thus very important that you
familiarize yourself with the expense process and rules that apply under the service and the
Local Employer to ensure that your workers have their expense claims reimbursed in a timely
manner.
The guidelines in this document are to ensure you have all the information you need to submit
your workers expense reimbursement claims, avoiding delays due to incorrect filing. Our
information is based on local laws of each country and the filing process applied under the
service and the Local Employer. All approved expenses will be paid as NET to the employee and
grossed up if they are not tax-free.
The below rules apply to locally based and paid workers.
Expense Policy Summary
All expenses reimbursement claims should be submitted in accordance with the the service
process:
1. Familiarize your worker on how to report their expenses through Expensify or a
manual expense report (to be agreed between the worker and manager). It is
important that you determine with the worker an internal process and expense policy
so that they know the method and deadline for submitting expense claims to their Line
Manager and how - via Expensify or the service expense report template.
2. Review submitted expense reports and approve expense claims, ensuring all required
supporting documents have been included e.g. receipts, invoices, by the agreed cutoff
date.
3. the service will share the submitted report with the Local Employer for processing and
reimbursement.
4. Expense reimbursements will be either processed along the salary and will be
reflected in the worker's pay slip or paid out separately, this depends on the relevant
local employer policy.
5. Under the Local Partner Global People, expenses that have been approved as a
business expense will be paid out as NET to the employee (grossed up if not tax free).

## Page 2

Expense Reimbursement Rules
There are many different types of expenses with different requirements and tax rules that must
be followed to ensure workers are reimbursed correctly and without delay.
In the table below you will find a summary of general regulations for expense reimbursements.
There are different invoice requirements and reimbursement process across each ICP; for
specific Local Expert guidelines, see here.
Please note that workers set up under the local expert Global People, all travel related expenses
must be reported using this template:
Travel Expense Report.xlsx
Supporting Documents
- Receipts and invoices must be submitted
with expenses.
- Online copies are sufficient, a hard copy
is not required.
- Clear and readable receipts and invoices
must be submitted with expenses.
- Without these documents any applicable
tax exemption cannot be applied.
- Documents must be actual tax receipts
or invoices; booking confirmations will not
suffice.
- Under certain Local employers, if
invoices are not issued in the Local
Employers name, then tax free
reimbursement is not possible.
- The exception to the above is where it is
not possible to use Local Employers name
e.g. on flight tickets or hotel bookings, in
which case the worker should put their own
name and details.
- There are different invoice requirements
and reimbursement process across each

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |


## Page 3

ICP; for specific Local Expert guidelines,
see here.
Business Expenses (Non-Travel)
- Business expenses related to workers
completing their job will usually be tax
exempt. Other expenses are subject to
varying tax rules.
- Only purely business related elements of
this expense will be tax free, anything
additional will be subject to tax.
- Online copies of invoices and receipts
are sufficient, a hard copy is not required.
- Laptops, office supplies etc will be tax
free providing sufficient proof (receipts,
invoices etc.) is included.
- Telephone reimbursement terms vary
depending on the local employer, see
additional information here.

|  |  |
| --- | --- |
|  |  |


## Page 4

Mileage
- Workers using private vehicles and
motors for work purposes should be
reimbursed according to the mileage
travelled.
- The set mileage details can be found
here.
- Our local expert Global People will
reimburse mileage per calculation method
based on route, car details and destination,
the worker will need to share a map with
the relevant route (google maps is
sufficient) and complete Global People's
travel report where applicable.
Business Travel (Domestic)
- Domestic business travel set specific
rates to reimburse meals.
- With a minimum duration of 24 hours,
€28 euros can be claimed for each full day,
and €14 euros for arrival and departure
days for partial days(which will obviously
be less than 24 hours).
- The current rates and details can be
found here.
- If meals have been pre-arranged the
meal allowance should be reduced by 20
to 40% depending on which meals were
provided.
- Any costs outside of the per diem should
be submitted as expenses against receipts
and invoices.
- Alternatively, all costs can be reimbursed
as expenses against receipts, instead of
providing a per diem.
- Reimburse per diem above the legal rate,
the amount above the legal rate is fully
taxable.
- Per diem method cannot be mixed up
with actual expenses. You will need to

|  |  |
| --- | --- |
|  |  |


## Page 5

agree with the worker on one method per
business trip.

|  |  |
| --- | --- |
|  |  |


## Page 6

Business Travel
- International business trips can be
reimbursed using the per diem method,
applying a set rate towards subsistence
(International)
costs tax free.
- The German government sets the
amounts for a per diem per each country,
according to the individual estimated cost
of living. These are updated annually and
reflect the maximum amount to which the
worker can be reimbursed tax-free.
- The current rates can be found here.
- The per diem rates covers hotel costs
only.
- Any per diem rate offered above the
government set rate will be fully taxable.
- Other costs such as travel will need to be
reimbursed via expenses with receipts.
- Online copies of invoices and receipts
are sufficient, a hard copy is not required.
- The Local Employers name and details
should appear on invoices, not the
workers.
- Meal costs are reimbursed according to
set meal allowances. When meals are
offered at no cost e.g. with the hotel or
provided by the host, the daily meal
allowance will be reduced by 20 to 40%
depending on which meals were provided.
- The current meal allowances rates can
be found here .
- Per diems are only tax-free for up to
three months of continuous business travel
in a given location. This is the "3-month
rule" or "3-Monatsfrist".
- Any stay lasting more than three days in
a week is considered a "long stay". Any
further stay at the same location will extend

|  |  |
| --- | --- |


## Page 7

the "long stay" if there are less than 28
days between each of these and further
stays. This "long stay" recording is
important as allowances for "long stays" of
more than three months are taxable.
- Per diem method cannot be mixed up
with actual expenses. You will need to
agree with the worker on one method per
business trip.

## Page 8

ICP Expense Process
Global People
To streamline the expenses process, Global People request the following procedure to be
followed:
All expense that has been approved by the client as a business expense will be NET
to the employee (grossed up if not tax free).
It is crucial that Global People will get a detailed context so they can identify tax free
expenses.
Expanses needs to be submitted in the following way:
One consolidated report per employee
Expanse details- type of expanse, context, copy of the invoice
Business trip report- each trip needs to be reported on a separate report.
Invoice- needs to be according to the attached instructions.
Any expenses that needs to be paid as a benefit- gross amount- must be reported as
a one time allowance and not as an expanse
Depending on which Local Experts your workers are set up under, the specific Expenses process
and reimbursement criteria can vary:
Atlas
Supporting Documents & Invoices
The worker or the company's name can appear on the invoice or supporting
documents.
Business Expenses (Non-Travel)
The following items might be considered as tax exempt providing the correct criteria is followed
and genuine business use:

## Page 9

Office equipment (business use)
Training (job-related)
Phone/internet (€20/month max)
Home office (€6/day, max €1,260/year)
Wellness benefits (max €600/year)
Additional insight can be found here §3 EStG - Tax Exemptions
Mileage
Mileage reimbursement requires providing a Fahrtenbuch (mileage logbook), which
must include date, route, purpose, and odometer readings (a Mileage log sample is
available on request).
Reimbursement rate will be €0.30 per km (standard tax-free rate for business trips
with a private vehicle).
Business Travel
Domestic Business trips will be covered according to these set per diems:
€14/day (over 8h)
€28/day (24h)
€14 (arrival/departure days)
Additional insights can be found here BMF Official Source
International Business trips will be covered according to rates which vary per country,
according to the information found here
https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuen
/Weitere_Steuerthemen/Reisekosten/2023-11-29-auslandsreisekosten-2024.html
Per diems will cover meals only. Accommodation and transport must be reimbursed
separately with receipts.
Receipts are not required for per diem when expensing a fixed daily allowance.
Global People
Supporting Documents & Invoices
The Local Employers name and details should appear on invoices, not the workers -
Global People DE GmbH Taunusanlage 8, 60329 Frankfurt, Germany VAT ID:
DE356366640.
If invoices are over €150, are required to note the employer's name, address and VAT
amount.

## Page 10

Receipts should be submitted with the same currency and clear exchange rate.
Supporting documents required to ensure the flight reimbursement is processed as
net: missing payment receipt/invoice as well as ticket copy.
Hotel/ flights etc invoices should indicate the name of the worker not the company.
Booking confirmations are not valid receipts.
All approved expenses will be paid as NET to the employee and grossed up if they
are not tax free.
Entertainment: for an entertainment expense to qualify, the entertainment has to have
been offered to a third party as well. Entertainment expenses solely on behalf of
employees working for the same company will not be accepted, an external party has
to be involved. Invoices are required to note Global People's name, address and VAT
amount.
Business Trip - submit a separate report for each trip.
Training expenses require the approval of the direct manager.
Business Expenses (Non-Travel)
The following items might be considered as tax exempt providing the correct criteria is followed,
including having Global People's name and details on the invoice:
IT equipment that is considered as company property.
Office supplies that are relevant and reasonable in amount.
Business travel expenses, according to the relevant ceilings and proving the correct
report template (see below in Business Travel section)
The following items are not tax exempt and employees should be compensated:
Meals (outside of the business travel report)
Fuel
Phone Bill
Transportation to the workplace
Office groceries
Other items which are not essential to carry out work activity.
Mileage
Mileage Reimbursement means compensating employees for using their personal vehicles for
work-related journeys.

## Page 11

Mileage will be reimbursed per journey details, calculated based on the route, car details and
destination. The worker will need to share a map with the relevant route (google maps is
sufficient) and complete the attached where applicable. KM reimbursement will be tax exempt
but fuel will be taxed.
Business Travel
As a general rule, reimbursements related to travel expenses are tax exempt (some
exclusions may apply).
Per diems will be tax exempt up to the specified amount under the tax law.
Expenditure over the limit will be taxed.
If the employer pays for meals on the trip, the per diem rate will be reduced.
If breakfast is included e.g. in the hotel fee, 20% of the flat rate will be deducted for
the day.
If lunch or dinner is provided by the employer, 40% of the fee will be removed.
For International business trips, the set per diem rate will vary according to the
country of travel, as outlined here.
Business travel expenses must be submitted using this report:
Travel Expense Report.xlsx
goGlobal
Supporting Documents & Invoices
The Local Employers name and details should appear on invoices, not the workers -
GoGlobal Germany GmbHPrielmayerstrasse, 3, 80335 Munich, Germany.
If invoices are not issued in the Local Employers name, then tax free reimbursement
is not possible. The exception to the above is where it is not possible to use Go
Global's name e.g. on flight tickets or hotel bookings, in which case the worker should
put their own name and details.
Go Global- An A1 certificate is required when travelling.
Business Expenses (Non-Travel)
Telephone costs can only be reimbursed tax-free at a flat rate of up to 20% of the
invoiced amount, up to a maximum of EUR 20 per month.
Mobile phone usage can only be reimbursed tax-free if the worker uses a separate
phone for personal use and can provide proof of this phone.
Internet costs can be reimbursed at a flat of 25% of the invoice amount tax free

## Page 12

Business Travel
For Domestic business trips, the total allowance per day is reduced to zero when all
meals (breakfast, lunch and dinner) are provided.
No receipts or invoices need to be provided when using the per diem method.
Parakar
Supporting Documents & Invoices
The Local Employers name and details should appear on invoices, not the workers -
Parakar Germany GmbH, Friesenpl. 4, 50672 Koln, Germany.
Original invoices, although stored digitally, need to be kept for 10 years.
Parakar only accepts expenses that are properly documented by means of invoices or
receipts from the provider, that specify the service provided.
For mobile phone and home internet expenses this is a necessity - any mobile phone
and home internet invoice that does not include "Parakar Germany GmbH" (at least in
c/o) cannot be reimbursed.
Invoices exceeding a gross amount of EUR 450 must contain the following additional
information:
The name of the worker and address
The tax or VAT ID of the restaurant
Invoice serial number
The date of the invoice and the date, the meal took place
Net amount, applicable tax rate and VAT
When submitting an expense the description of the reason for the expense, should be
as precise and detailed as possible.
Business Expenses (Non-Travel)
Telephone costs can only be reimbursed tax-free at a flat rate of up to 20% of the
invoiced amount, up to a maximum of EUR 20 per month.
Mobile phone usage can only be reimbursed tax-free if the worker uses a separate
phone for personal use and can provide proof of this phone-
Reimbursement of average expenses on business behalf: Based on a three month
record an average percentage rate is determined on how much the private cell phone
is used for business purposes- The client concludes a contract (and may also
purchase a mobile phone, depending on the case) for your usage. This option is tax-
free, as well, even if the plan and cell phone are used for private purposes.

## Page 13

Parakar Personal meals cannot be reimbursed tax-free; instead, you may use per
diems to cover additional meal costs when traveling for business
Business Travel
For Domestic business trips, the total allowance per day is reduced to zero when all
meals (breakfast, lunch and dinner) are provided.
No receipts or invoices need to be provided when using the per diem method.
Disclaimer:
Please note this is a general guide to help you understand the process of Expense
Reimbursement according to the laws of your country of employment and the process
requirements through your Local Employer and the service Global.

## Page 14

zurück
weiter
Nichtamtliches Inhaltsverzeichnis
Einkommensteuerge
setz (EStG)
§ 9 Werbungskosten
(1) Werbungskosten sind Aufwendungen zur Erwerbung, Sicherung und
Erhaltung der Einnahmen. ²Sie sind bei der Einkunftsart abzuziehen, bei
der sie erwachsen sind. 3Werbungskosten sind auch
1.
Schuldzinsen und auf besonderen Verpflichtungsgründen beruhende
Renten und dauernde Lasten, soweit sie mit einer Einkunftsart in
wirtschaftlichem Zusammenhang stehen. ²Bei Leibrenten kann nur der
Anteil abgezogen werden, der sich nach § 22 Nummer 1 Satz 3
Buchstabe a Doppelbuchstabe bb ergibt;
2.
Steuern vom Grundbesitz, sonstige öffentliche Abgaben und
Versicherungsbeiträge, soweit solche Ausgaben sich auf Gebäude oder
auf Gegenstände beziehen, die dem Steuerpflichtigen zur
Einnahmeerzielung dienen;
3.
Beiträge zu Berufsständen und sonstigen Berufsverbänden, deren Zweck
nicht auf einen wirtschaftlichen Geschäftsbetrieb gerichtet ist;
4.
Aufwendungen des Arbeitnehmers für die Wege zwischen Wohnung und
erster Tätigkeitsstätte im Sinne des Absatzes 4. ²Zur Abgeltung dieser
Aufwendungen ist für jeden Arbeitstag, an dem der Arbeitnehmer die
erste Tätigkeitsstätte aufsucht eine Entfernungspauschale für jeden

## Page 15

vollen Kilometer der Entfernung zwischen Wohnung und erster
Tätigkeitsstätte von 0,30 Euro anzusetzen, höchstens jedoch 500 Euro
im Kalenderjahr; ein höherer Betrag als 4 500 Euro ist anzusetzen,
soweit der Arbeitnehmer einen eigenen oder ihm zur Nutzung
überlassenen Kraftwagen benutzt. ³Die Entfernungspauschale gilt nicht
für Flugstrecken und Strecken mit steuerfreier Sammelbeförderung nach
§ 3 Nummer 32. ⁴Für die Bestimmung der Entfernung ist die kürzeste
Straßenverbindung zwischen Wohnung und erster Tätigkeitsstätte
maßgebend; eine andere als die kürzeste Straßenverbindung kann
zugrunde gelegt werden, wenn diese offensichtlich verkehrsgünstiger ist
und vom Arbeitnehmer regelmäßig für die Wege zwischen Wohnung und
erster Tätigkeitsstätte benutzt wird. ⁵Nach § 8 Absatz 2 Satz 11 oder
Absatz 3 steuerfreie Sachbezüge für Fahrten zwischen Wohnung und
erster Tätigkeitsstätte mindern den nach Satz 2 abziehbaren Betrag; ist
der Arbeitgeber selbst der Verkehrsträger, ist der Preis anzusetzen, den
ein dritter Arbeitgeber an den Verkehrsträger zu entrichten hätte. ⁶Hat ein
Arbeitnehmer mehrere Wohnungen, so sind die Wege von einer
Wohnung, die nicht der ersten Tätigkeitsstätte am nächsten liegt, nur zu
berücksichtigen, wenn sie den Mittelpunkt der Lebensinteressen des
Arbeitnehmers bildet und nicht nur gelegentlich aufgesucht wird. 7 Nach §
3 Nummer 37 steuerfreie Sachbezüge mindern den nach Satz 2
abziehbaren Betrag nicht; § 3c Absatz 1 ist nicht anzuwenden. ⁸Zur
Abgeltung der Aufwendungen im Sinne des Satzes 1 ist für die
Veranlagungszeiträume 2021 bis 2026 abweichend von Satz 2 für jeden
Arbeitstag, an dem der Arbeitnehmer die erste Tätigkeitsstätte aufsucht,
eine Entfernungspauschale für jeden vollen Kilometer der ersten 20
Kilometer der Entfernung zwischen Wohnung und erster Tätigkeitsstätte
von 0,30 Euro und für jeden weiteren vollen Kilometer
a)
von 0,35 Euro für 2021,
b)
von 0,38 Euro für 2022 bis 2026
anzusetzen, höchstens 4 500 Euro im Kalenderjahr; ein höherer Betrag
als 4500 Euro ist anzusetzen, soweit der Arbeitnehmer einen eigenen
oder ihm zur Nutzung überlassenen Kraftwagen benutzt.
4a.
Aufwendungen des Arbeitnehmers für beruflich veranlasste Fahrten, die
nicht Fahrten zwischen Wohnung und erster Tätigkeitsstätte im Sinne
des Absatzes 4 sowie keine Familienheimfahrten sind. ²Anstelle der
tatsächlichen Aufwendungen, die dem Arbeitnehmer durch die
persönliche Benutzung eines Beförderungsmittels entstehen, können die
Fahrtkosten mit den pauschalen Kilometersätzen angesetzt werden, die
für das jeweils benutzte Beförderungsmittel (Fahrzeug) als höchste
Wegstreckenentschädigung nach dem Bundesreisekostengesetz
festgesetzt sind. ³Hat ein Arbeitnehmer keine erste Tätigkeitsstätte (§ 9

## Page 16

Absatz 4) und hat er nach den dienst- oder arbeitsrechtlichen
Festlegungen sowie den diese ausfüllenden Absprachen und Weisungen
zur Aufnahme seiner beruflichen Tätigkeit dauerhaft denselben Ort oder
dasselbe weiträumige Tätigkeitsgebiet typischerweise arbeitstäglich
aufzusuchen, gilt Absatz 1 Satz 3 Nummer 4 und Absatz 2 für die
Fahrten von der Wohnung zu diesem Ort oder dem zur Wohnung
nächstgelegenen Zugang zum Tätigkeitsgebiet entsprechend. 4Für die
Fahrten innerhalb des weiträumigen Tätigkeitsgebietes gelten die Sätze 1
und 2 entsprechend.
5.
notwendige Mehraufwendungen, die einem Arbeitnehmer wegen einer
beruflich veranlassten doppelten Haushaltsführung entstehen. ²Eine
doppelte Haushaltsführung liegt nur vor, wenn der Arbeitnehmer
außerhalb des Ortes seiner ersten Tätigkeitsstätte einen eigenen
Hausstand unterhält und auch am Ort der ersten Tätigkeitsstätte wohnt.
3 Das Vorliegen eines eigenen Hausstandes setzt das Innehaben einer
Wohnung sowie eine finanzielle Beteiligung an den Kosten der
Lebensführung voraus. ⁴Als Unterkunftskosten für eine doppelte
Haushaltsführung können im Inland die tatsächlichen Aufwendungen für
die Nutzung der Unterkunft angesetzt werden, höchstens 1 000 Euro im
Monat. ⁵Aufwendungen für die Wege vom Ort der ersten Tätigkeitsstätte
zum Ort des eigenen Hausstandes und zurück (Familienheimfahrt)
können jeweils nur für eine Familienheimfahrt wöchentlich abgezogen
werden. ⁶Zur Abgeltung der Aufwendungen für eine Familienheimfahrt ist
eine Entfernungspauschale von 0,30 Euro für jeden vollen Kilometer der
Entfernung zwischen dem Ort des eigenen Hausstandes und dem Ort der
ersten Tätigkeitsstätte anzusetzen. ⁷Nummer 4 Satz 3 bis 5 ist
entsprechend anzuwenden. ⁸Aufwendungen für Familienheimfahrten mit
einem dem Steuerpflichtigen im Rahmen einer Einkunftsart überlassenen
Kraftfahrzeug werden nicht berücksichtigt. ⁹Zur Abgeltung der
Aufwendungen für eine Familienheimfahrt ist für die
Veranlagungszeiträume 2021 bis 2026 abweichend von Satz 6 eine
Entfernungspauschale für jeden vollen Kilometer der ersten 20 Kilometer
der Entfernung zwischen dem Ort des eigenen Hausstandes und dem Ort
der ersten Tätigkeitsstätte von 0,30 Euro und für jeden weiteren vollen
Kilometer
a)
von 0,35 Euro für 2021,
b)
von 0,38 Euro für 2022 bis 2026
anzusetzen.
5a.

## Page 17

notwendige Mehraufwendungen eines Arbeitnehmers für beruflich
veranlasste Übernachtungen an einer Tätigkeitsstätte, die nicht erste
Tätigkeitsstätte ist. 2Übernachtungskosten sind die tatsächlichen
Aufwendungen für die persönliche Inanspruchnahme einer Unterkunft zur
Übernachtung. 3 Soweit höhere Übernachtungskosten anfallen, weil der
Arbeitnehmer eine Unterkunft gemeinsam mit Personen nutzt, die in
keinem Dienstverhältnis zum selben Arbeitgeber stehen, sind nur
diejenigen Aufwendungen anzusetzen, die bei alleiniger Nutzung durch
den Arbeitnehmer angefallen wären. ⁴Nach Ablauf von 48 Monaten einer
längerfristigen beruflichen Tätigkeit an derselben Tätigkeitsstätte, die
nicht erste Tätigkeitsstätte ist, können Unterkunftskosten nur noch bis zur
Höhe des Betrags nach Nummer 5 angesetzt werden. ⁵Eine
Unterbrechung dieser beruflichen Tätigkeit an derselben Tätigkeitsstätte
führt zu einem Neubeginn, wenn die Unterbrechung mindestens sechs
Monate dauert.
5b.
notwendige Mehraufwendungen, die einem Arbeitnehmer während seiner
auswärtigen beruflichen Tätigkeit auf einem Kraftfahrzeug des
Arbeitgebers oder eines vom Arbeitgeber beauftragten Dritten im
Zusammenhang mit einer Übernachtung in dem Kraftfahrzeug für
Kalendertage entstehen, an denen der Arbeitnehmer eine
Verpflegungspauschale nach Absatz 4a Satz 3 Nummer 1 und 2 sowie
Satz 5 zur Nummer 1 und 2 beanspruchen könnte. 2 Anstelle der
tatsächlichen Aufwendungen, die dem Arbeitnehmer im Zusammenhang
mit einer Übernachtung in dem Kraftfahrzeug entstehen, kann im
Kalenderjahr einheitlich eine Pauschale von 9 Euro für jeden Kalendertag
berücksichtigt werden, an dem der Arbeitnehmer eine
Verpflegungspauschale nach Absatz 4a Satz 3 Nummer 1 und 2 sowie
Satz 5 zur Nummer 1 und 2 beanspruchen könnte,
6.
Aufwendungen für Arbeitsmittel, zum Beispiel für Werkzeuge und
typische Berufskleidung. ²Nummer 7 bleibt unberührt;
7.
Absetzungen für Abnutzung und für Substanzverringerung,
Sonderabschreibungen nach § 7b und erhöhte Absetzungen. 2§ 6 Absatz
2 Satz 1 bis 3 ist in Fällen der Anschaffung oder Herstellung von
Wirtschaftsgütern entsprechend anzuwenden.
(2) Durch die Entfernungspauschalen sind sämtliche Aufwendungen
abgegolten, die durch die Wege zwischen Wohnung und erster
Tätigkeitsstätte im Sinne des Absatzes 4 und durch die
Familienheimfahrten veranlasst sind. ²Aufwendungen für die Benutzung
öffentlicher Verkehrsmittel können angesetzt werden, soweit sie den im
Kalenderjahr insgesamt als Entfernungspauschale abziehbaren Betrag
übersteigen. ³Menschen mit Behinderungen,
1.

## Page 18

deren Grad der Behinderung mindestens 70 beträgt,
2.
deren Grad der Behinderung weniger als 70, aber mindestens 50 beträgt
und die in ihrer Bewegungsfähigkeit im Straßenverkehr erheblich
beeinträchtigt sind,
können anstelle der Entfernungspauschalen die tatsächlichen
Aufwendungen für die Wege zwischen Wohnung und erster
Tätigkeitsstätte und für Familienheimfahrten ansetzen. ⁴Die
Voraussetzungen der Nummern 1 und 2 sind durch amtliche Unterlagen
nachzuweisen.
(3) Absatz 1 Satz 3 Nummer 4 bis 5a sowie die Absätze 2 und 4a gelten
bei den Einkunftsarten im Sinne des § 2 Absatz 1 Satz 1 Nummer 5 bis 7
entsprechend.
(4) Erste Tätigkeitsstätte ist die ortsfeste betriebliche Einrichtung des
Arbeitgebers, eines verbundenen Unternehmens (§ 15 des
Aktiengesetzes) oder eines vom Arbeitgeber bestimmten Dritten, der der
Arbeitnehmer dauerhaft zugeordnet ist. ²Die Zuordnung im Sinne des
Satzes 1 wird durch die dienst- oder arbeitsrechtlichen Festlegungen
sowie die diese ausfüllenden Absprachen und Weisungen bestimmt.
³Vₒₙ einer dauerhaften Zuordnung ist insbesondere auszugehen, wenn
der Arbeitnehmer unbefristet, für die Dauer des Dienstverhältnisses oder
über einen Zeitraum von 48 Monaten hinaus an einer solchen
Tätigkeitsstätte tätig werden soll. ⁴Fehlt eine solche dienst- oder
arbeitsrechtliche Festlegung auf eine Tätigkeitsstätte oder ist sie nicht
eindeutig, ist erste Tätigkeitsstätte die betriebliche Einrichtung, an der der
Arbeitnehmer dauerhaft
1.
typischerweise arbeitstäglich tätig werden soll oder
2.
je Arbeitswoche zwei volle Arbeitstage oder mindestens ein Drittel seiner
vereinbarten regelmäßigen Arbeitszeit tätig werden soll.
⁵ Je Dienstverhältnis hat der Arbeitnehmer höchstens eine erste
Tätigkeitsstätte. ⁶Liegen die Voraussetzungen der Sätze 1 bis 4 für
mehrere Tätigkeitsstätten vor, ist diejenige Tätigkeitsstätte erste
Tätigkeitsstätte, die der Arbeitgeber bestimmt. Fehlt es an dieser
Bestimmung oder ist sie nicht eindeutig, ist die der Wohnung örtlich am
nächsten liegende Tätigkeitsstätte die erste Tätigkeitsstätte. ⁸Als erste
Tätigkeitsstätte gilt auch eine Bildungseinrichtung, die außerhalb eines
Dienstverhältnisses zum Zwecke eines Vollzeitstudiums oder einer
vollzeitigen Bildungsmaßnahme aufgesucht wird; die Regelungen für
Arbeitnehmer nach Absatz 1 Satz 3 Nummer 4 und 5 sowie Absatz 4a
sind entsprechend anzuwenden.

## Page 19

(4a) Mehraufwendungen des Arbeitnehmers für die Verpflegung sind
nur nach Maßgabe der folgenden Sätze als Werbungskosten abziehbar.
²Wird der Arbeitnehmer außerhalb seiner Wohnung und ersten
Tätigkeitsstätte beruflich tätig (auswärtige berufliche Tätigkeit), ist zur
Abgeltung der ihm tatsächlich entstandenen, beruflich veranlassten
Mehraufwendungen eine Verpflegungspauschale anzusetzen. Diese
beträgt
1.
28 Euro für jeden Kalendertag, an dem der Arbeitnehmer 24 Stunden von
seiner Wohnung und ersten Tätigkeitsstätte abwesend ist,
2.
jeweils 14 Euro für den An- und Abreisetag, wenn der Arbeitnehmer an
diesem, einem anschließenden oder vorhergehenden Tag außerhalb
seiner Wohnung übernachtet,
3.
14 Euro für den Kalendertag, an dem der Arbeitnehmer ohne
Übernachtung außerhalb seiner Wohnung mehr als 8 Stunden von seiner
Wohnung und der ersten Tätigkeitsstätte abwesend ist; beginnt die
auswärtige berufliche Tätigkeit an einem Kalendertag und endet am
nachfolgenden Kalendertag ohne Übernachtung, werden 14 Euro für den
Kalendertag gewährt, an dem der Arbeitnehmer den überwiegenden Teil
der insgesamt mehr als 8 Stunden von seiner Wohnung und der ersten
Tätigkeitsstätte abwesend ist.
4Hat der Arbeitnehmer keine erste Tätigkeitsstätte, gelten die Sätze 2
und 3 entsprechend; Wohnung im Sinne der Sätze 2 und 3 ist der
Hausstand, der den Mittelpunkt der Lebensinteressen des Arbeitnehmers
bildet sowie eine Unterkunft am Ort der ersten Tätigkeitsstätte im
Rahmen der doppelten Haushaltsführung. ⁵Bei einer Tätigkeit im Ausland
treten an die Stelle der Pauschbeträge nach Satz 3 länderweise
unterschiedliche Pauschbeträge, die für die Fälle der Nummer 1 mit 120
sowie der Nummern 2 und 3 mit 80 Prozent der Auslandstagegelder nach
dem Bundesreisekostengesetz vom Bundesministerium der Finanzen im
Einvernehmen mit den obersten Finanzbehörden der Länder aufgerundet
auf volle Euro festgesetzt werden; dabei bestimmt sich der Pauschbetrag
nach dem Ort, den der Arbeitnehmer vor 24 Uhr Ortszeit zuletzt erreicht,
oder, wenn dieser Ort im Inland liegt, nach dem letzten Tätigkeitsort im
Ausland. ⁶Dₑᵣ Abzug der Verpflegungspauschalen ist auf die ersten drei
Monate einer längerfristigen beruflichen Tätigkeit an derselben
Tätigkeitsstätte beschränkt. Eine Unterbrechung der beruflichen
Tätigkeit an derselben Tätigkeitsstätte führt zu einem Neubeginn, wenn
sie mindestens vier Wochen dauert. ⁸Wird dem Arbeitnehmer anlässlich
oder während einer Tätigkeit außerhalb seiner ersten Tätigkeitsstätte
vom Arbeitgeber oder auf dessen Veranlassung von einem Dritten eine
Mahlzeit zur Verfügung gestellt, sind die nach den Sätzen 3 und 5
ermittelten Verpflegungspauschalen zu kürzen:
1.

## Page 20

für Frühstück um 20 Prozent,
2.
für Mittag- und Abendessen um jeweils 40 Prozent,
der nach Satz 3 Nummer 1 gegebenenfalls in Verbindung mit Satz 5
maßgebenden Verpflegungspauschale für einen vollen Kalendertag; die
Kürzung darf die ermittelte Verpflegungspauschale nicht übersteigen.
⁹Satz 8 gilt auch, wenn Reisekostenvergütungen wegen der zur
Verfügung gestellten Mahlzeiten einbehalten oder gekürzt werden oder
die Mahlzeiten nach § 40 Absatz 2 Satz 1 Nummer 1a pauschal
besteuert werden. ¹⁰Hat der Arbeitnehmer für die Mahlzeit ein Entgelt
gezahlt, mindert dieser Betrag den Kürzungsbetrag nach Satz 8. 11 Erhält
der Arbeitnehmer steuerfreie Erstattungen für Verpflegung, ist ein
Werbungskostenabzug insoweit ausgeschlossen. ¹²Die
Verpflegungspauschalen nach den Sätzen 3 und 5, die Dreimonatsfrist
nach den Sätzen 6 und 7 sowie die Kürzungsregelungen nach den
Sätzen 8 bis 10 gelten entsprechend auch für den Abzug von
Mehraufwendungen für Verpflegung, die bei einer beruflich veranlassten
doppelten Haushaltsführung entstehen, soweit der Arbeitnehmer vom
eigenen Hausstand im Sinne des § 9 Absatz 1 Satz 3 Nummer 5
abwesend ist; dabei ist für jeden Kalendertag innerhalb der
Dreimonatsfrist, an dem gleichzeitig eine Tätigkeit im Sinne des Satzes 2
oder des Satzes 4 ausgeübt wird, nur der jeweils höchste in Betracht
kommende Pauschbetrag abziehbar. ¹³Die Dauer einer Tätigkeit im
Sinne des Satzes 2 an dem Tätigkeitsort, an dem die doppelte
Haushaltsführung begründet wurde, ist auf die Dreimonatsfrist
anzurechnen, wenn sie ihr unmittelbar vorausgegangen ist.
(5) 4 Absatz 5 Satz 1 Nummer 1 bis 4, 6b bis 8a, 10, 12 und Absatz 6
gilt sinngemäß. ²Die §§ 4j, 4k, 6 Absatz 1 Nummer 1a und § 6e gelten
entsprechend.
(6) Aufwendungen des Steuerpflichtigen für seine Berufsausbildung
oder für sein Studium sind nur dann Werbungskosten, wenn der
Steuerpflichtige zuvor bereits eine Erstausbildung (Berufsausbildung oder
Studium) abgeschlossen hat oder wenn die Berufsausbildung oder das
Studium im Rahmen eines Dienstverhältnisses stattfindet. ²Eine
Berufsausbildung als Erstausbildung nach Satz 1 liegt vor, wenn eine
geordnete Ausbildung mit einer Mindestdauer von 12 Monaten bei
vollzeitiger Ausbildung und mit einer Abschlussprüfung durchgeführt wird.
³Eine geordnete Ausbildung liegt vor, wenn sie auf der Grundlage von
Rechts- oder Verwaltungsvorschriften oder internen Vorschriften eines
Bildungsträgers durchgeführt wird. 41st eine Abschlussprüfung nach dem
Ausbildungsplan nicht vorgesehen, gilt die Ausbildung mit der
tatsächlichen planmäßigen Beendigung als abgeschlossen. ⁵Eine
Berufsausbildung als Erstausbildung hat auch abgeschlossen, wer die
Abschlussprüfung einer durch Rechts- oder Verwaltungsvorschriften
geregelten Berufsausbildung mit einer Mindestdauer von 12 Monaten
bestanden hat, ohne dass er zuvor die entsprechende Berufsausbildung
durchlaufen hat.

## Page 21

Fußnote
(+++ § 9: Zur Anwendung vgl. § 52 +++)
(+++ § 9 Abs. 1,2,4, 4a: Zur Anwendung vgl. § 10 Abs. 1 +++)
(+++ § 9 Abs. 1 Satz 3 Nr. 5b: Zur Anwendung vgl. § 4 Abs. 10 +++)

|  |  |
| --- | --- |
|  |  |
|  |  |
`,
    "pageCount": 1,
    "icps": [
      "Global People",
      "Atlas",
      "GoGlobal",
      "Parakar"
    ],
    "metadata": {
      "title": "Germany",
      "version": "1",
      "parsedDate": "2026-01-26T15:58:16.180Z",
      "parserUsed": "Textract",
      "sourceFile": "Expenses Germany .pdf",
      "effectiveDate": "2026-01-26T06:33:07"
    }
  },
  "Austria": {
    "name": "Austria",
    "code": "AT",
    "policyMarkdown": `

## Page 1

Introduction
An expense reimbursement process allows you to reimburse your workers for situations where
they have used their own funds to cover business related items.
Expense reimbursement rules, taxation laws and claims process vary greatly under each
country's employment legislation and company policies. It is thus very important that you
familiarize yourself with the expense process and rules that apply under the service and the
Local Employer to ensure that your workers have their expense claims reimbursed in a timely
manner.
The guidelines in this document are to ensure you have all the information you need to submit
your workers expense reimbursement claims, avoiding delays due to incorrect filing. Our
information is based on local laws of each country and the filing process applied under the
service and the Local Employer.
All approved expenses will be paid as NET to the employee and grossed up if they are not tax-
free.
The below rules apply to locally based and paid workers.
Expense Reimbursement Process Steps
All expenses reimbursement claims should be submitted in accordance with the the service
process:
1. Familiarize your worker on how to report their expenses. It is important that you
determine with the worker an internal process and expense policy so that they know
the method and deadline for submitting expense claims to their Line Manager and
how.
2. Review submitted expense reports and approve expense claims, ensuring all required
supporting documents have been included e.g. receipts, invoices, by the agreed
cutoff date.
3. Expense reimbursements will be processed within the monthly payroll run and will be
reflected in the worker's pay slip.
Expense Reimbursement Rules & Template

## Page 2

The attached form should be used when submitting business travel and mileage expenses:
Travel Expense Report Template Austria EUR.xlsx
There are many different types of expenses with different requirements and tax rules that must
be followed to ensure workers are reimbursed correctly and without delay.

## Page 3

Supporting Documents
- Receipts and invoices must be submitted
with expenses.
- Online copies are sufficient, a hard copy is
not required.
- The Local Employers name and details
should appear on invoices, not the workers:
<Global People
Global People IT-Services GmbH
Kärntner Ring 12, A-1010
Vienna, Austria VAT ID: ATU77112189
- Hotel/ flights invoices should indicate the
name of the worker not the end client.
- Without these documents any applicable
tax exemption cannot be applied.

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |


## Page 4

- Documents must be actual tax receipts or
invoices; booking confirmations will not
suffice.
- Business Trip - submit a separate report
for each trip (see the template above this
table).
- Any personal information not required for
reimbursement purposes should be
removed before it is submitted.
- Receipts should be submitted with the
same currency and clear exchange rate.
- All approved expenses will be paid as
NET to the employee and grossed up if they
are not tax free.
- Training expenses require the approval of
the direct manager.

## Page 5

Business Expenses (Non-Travel)
- Business expenses related to workers
completing their job will usually be tax
exempt. Other expenses are subject to
varying tax rules.
- Home office costs, including furniture,
follow specific tax allowances and rules. The
rates can be found here.
- Tax exemptions will only be applied
providing sufficient proof is shared e.g. tax
receipts, invoices.
- All expenses that has been approved by
the client as a business expense will be
NET to the employee (grossed up) if not tax
free.
- Training expenses require the approval of
the direct manager.
- Online copies of invoices and receipts are
sufficient, a hard copy is not required.

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |


## Page 6

Mileage
- Workers using private vehicles,
motorbikes, bicycles, passengers for work
purposes should be reimbursed according to
the mileage travelled.
- To claim mileage, a record of kilometers
traveled must be submitted.
- You can find the current mileage
reimbursement rates here Mileage
allowance (oesterreich.gv.at).
- Our local partner reimburses mileage per
calculation method based on route, car
details and destination, the worker will need
to share a map with the relevant route
(google maps is sufficient) and the travel
reporting template (see above the this
table).
- Parking tickets should be included within
the Mileage payment. If it is paid outside of
Mileage it will be taxed.

## Page 7

Business Travel (Domestic)
- Domestic business trips have set per diem
rates which covers meals.
- A per diem method cannot be mixed with
actual expenses. You will need to agree with
the worker on one method per business trip.
- This per diem entitlement is for workers
who travel more than 25 kilometres from
their place of business.
- The current rates and pro ratio according
to the hours of the duration of the trip can be
found here.
- A maximum of 12 hours per day can be
paid, capped at a per diem of 26.40 Euros
(tax free).
- If meals are provided by the
employer/host, the set per diem is reduced
by 50%.
- Lodging should be paid separately upon
receiving the proper invoice/receipt or 15
Euro without a receipt.
- Travel expenses must be submitted using
the travel report template (found above this
table).

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |


## Page 8

Business Travel (International)
- International business trips can be
reimbursed by either using the per diem
method to applying a set rate tax free or by
simply reimbursing workers against
expenses and receipts.
- Per diems can be used to cover meals.
- When using the per diem method
(covering meals, workers are given a set
subsistence allowance tax free based on the
Government limits set for each destination.
The current per diem rates can be found
here.
- The daily per diem rate may be increased
at your discretion. However, to be tax-
exempt a receipt must be submitted for the
amount above the set government per diem
rate.
- If lunch and dinner are provided (breakfast
is not considered) on the trip the per diem
allowance will be reduced by two thirds i.e.
only a third of the fixed meals amount is
allowed to be paid to the employee tax free.
- You can choose to pay your worker the
per diem rate in advance of the trip or upon
their return.
- Expenses that fall outside of per diem can
be paid out as expense reimbursements
against receipts.

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |


## Page 9

- A per diem method cannot be mixed with
actual expenses. You will need to agree with
the worker on one method per business trip.
- The Local Employers name and details
should appear on invoices, unless it is not
possible to do so in which case the workers
name can be used e.g. for flight bookings.
- Travel expenses must be submitted using
the travel report template (found above this
table).

## Page 10

Lohnsteuerliche Behandlung von
Dienstreisen
Informationen und Berechnung
Lesedauer: 6 Minuten
Inhaltsverzeichnis
Begriff der Dienstreise
Details zur Dienstreise (Tatbestände)
Lohnsteuerliche Behandlung von Inlandsdienstreisen
Lohnsteuerliche Behandlung von Auslandsdienstreisen
Abgabenrechtliche Behandlung der steuerfreien Reiseaufwendungen
Vorsteuerabzug bei Reisekosten
Kilometergeld für die Benutzung eines privaten Kraftfahrzeuges
Zum Inhaltsverzeichnis
Begriff der Dienstreise
Eine Dienstreise (iSd Einkommensteuergesetztes) liegt vor, wenn
ein Arbeitnehmer über Auftrag des Arbeitgebers seinen Dienstort (Büro,
Betriebsstätte, Werksgelände, Lager, etc.) zur Durchführung von
Dienstverrichtungen verlässt (1. Tatbestand) oder
der Arbeitnehmer soweit weg von seinem ständigen Wohnort
(Familienwohnsitz) arbeitet, dass ihm eine tägliche Rückkehr nicht zugemutet
werden kann (2. Tatbestand). Unzumutbar ist die Rückkehr jedenfalls bei einer
Entfernung von 120 km.
Hinweis: Enthält eine lohngestaltende Vorschrift (z.B. Kollektivvertrag) eine
besondere Regelung des Begriffes Dienstreise, so ist diese Regelung anzuwenden.
Details zur Dienstreise (Tatbestände)
Dienstreise nach dem 1. Tatbestand

## Page 11

Tagesgelder können auf Grund des Verpflegungsmehraufwandes solange steuerfrei
gewährt werden, als kein weiterer Mittelpunkt der Tätigkeit begründet wird.
Ein neuer Mittelpunkt der Tätigkeit entsteht
bei durchgehender sowie regelmäßig wiederkehrender Tätigkeit (mindestens
einmal pro Woche) am gleichen Einsatzort nach den ersten 5 Tagen
bei unregelmäßig wiederkehrender Tätigkeit am gleichen Einsatzort nach den
ersten 15 Tagen (pro Kalenderjahr)
Die ab dem 6. bzw. 16. Tag bezahlten Tagesgelder sind steuerpflichtig.
Dienstreise nach dem 2. Tatbestand (mehr als 120 km vom Dienstort entfernt)
Tagesgelder können für einen Zeitraum von 6 Monaten an ein und demselben Ort
steuerfrei gewährt werden. Ab dem 7. Monat gezahlte Tages- und
Nächtigungsgelder sind steuerpflichtig. Bei einem Wechsel des Arbeitsortes (d.h. in
eine andere politische Gemeinde) beginnt eine neue 6-Monats-Frist zu laufen.
Dienstreise nach einer lohngestaltenden Vorschrift
Wenn der Arbeitgeber auf Grund einer lohngestaltenden Vorschrift zur Zahlung von
Tagesgeldern verpflichtet ist, können diese für folgende Tätigkeiten zeitlich
unbegrenzt steuerfrei ausbezahlt werden:
Außendiensttätigkeiten (z.B. Kundenbesuche, Patrouillendienste, Servicedienste
außerhalb des Betriebsgeländes),
Fahrtätigkeiten (Zustelldienste, Taxifahrten, Linienverkehr, Transportfahrten
außerhalb des Betriebsgeländes)
Baustellen- und Montagetätigkeiten (außerhalb des Betriebsgeländes)
Arbeitskräfteüberlassung
Für vorübergehende Tätigkeiten an einem Einsatzort in einer anderen politischen
Gemeinde
z.B. bei Entsendung für Ausbildungszwecke an einen Schulungsort, bei
Springertätigkeiten oder Aushilfstätigkeiten in einer anderen Filiale des
Unternehmens, wobei in diesen Fällen für die Steuerfreiheit naturgemäß eine durch
die vorübergehende Tätigkeit vorgegebene zeitliche Beschränkung besteht. Diese
zeitliche Beschränkung beträgt 183 Tage. Tagesgelder bis 183 Tage an diesem
Einsatzort bleiben steuerfrei, darüber hinaus sind sie steuerpflichtig. Hält sich der
Arbeitnehmer länger als sechs Monate nicht in dieser politischen Gemeinde auf,
beginnt die Frist neu zu laufen.

## Page 12

Sieht eine lohngestaltende Vorschrift Tagesgelder vor, bleiben diese ohne zeitliche
Beschränkung (beim Tatbestand ,,vorübergehende Verwendung an einem Einsatzort
in einer anderen politischen Gemeinde maximal 183 Tage), auch bei Begründung
eines weiteren Mittelpunktes der Tätigkeit, steuerfrei. Steuerfrei bleiben die
Tagesgelder nur in Höhe jener Beträge, auf die der Arbeitnehmer aufgrund der
lohngestaltenden Vorschrift Anspruch hat, höchstens jedoch 30 EUR.
Unter einer lohngestaltenden Vorschrift versteht man insbesondere
gesetzliche Vorschriften
Dienst- oder Besoldungsordnung
Kollektivvertrag oder
bestimmte gesetzlich geregelte Betriebsvereinbarungen
Lohnsteuerliche Behandlung von Inlandsdienstreisen
Tagesgelder
Beträge, die einem Arbeitnehmer aus Anlass einer Dienstreise als Tagesgelder
gezahlt werden, sind bis zu einer gewissen Höhe lohnsteuerfrei. Höchstens können
30 EUR am Tag, bei einer kürzer als 12 Stunden aber länger als 3 Stunden
dauernden Dienstreise 2,50 EUR pro Stunde, steuerfrei belassen werden.
Das Tagesgeld steht grundsätzlich nach der 24-Stunden-Regelung zu. Nur wenn
eine arbeitsrechtliche Vorschrift die Berechnung nach Kalendertagen vorsieht oder
der Arbeitgeber mangels einer arbeitsrechtlichen Vorschrift nach Kalendertagen
abrechnet, ist diese Berechnungsmethode auch steuerrechtlich maßgebend.
Dauer der Reise
Anteiliges Taggeld
0 bis 3 Stunden
0,00 EUR
3 bis 4 Stunden
4/12
10,00 EUR
4 bis 5 Stunden
5/12
12,50 EUR
5 bis 6 Stunden
6/12
15,00 EUR
6 bis 7 Stunden
7/12
17,50 EUR

|  |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |


## Page 13

7 bis 8 Stunden
8/12
20,00 EUR
8 bis 9 Stunden
9/12
22,50 EUR
9 bis 10 Stunden
10/12
25,00 EUR
10 bis 11 Stunden
11/12
27,50 EUR
11 bis 24 Stunden
12/12
30,00 EUR
Wird vom Arbeitgeber ein der Werbung dienendes Arbeitsessen bezahlt, dann ist
das Taggeld steuerlich um 15 EUR zu kürzen. Ab zwei bezahlten Arbeitsessen pro
Tag steht kein steuerfreies Taggeld mehr zu.
Achtung:
Es muss immer unterschieden werden:
1. Wieviel an Taggeld steht dem Arbeitnehmer arbeitsrechtlich, z.B. It.
Kollektivvertrag, zu?
2. Wieviel davon ist steuerfrei und wieviel davon ist steuerpflichtig?
Nächtigungsgelder
Das Nächtigungsgeld kann nur dann steuerfrei belassen werden, wenn tatsächlich
genächtigt wird. Der Umstand der Nächtigung ist grundsätzlich nachzuweisen. Bei
Entfernungen von mindestens 120 km zwischen Einsatzort und Wohnort hat der
Arbeitgeber jedoch nicht zu prüfen, ob der Arbeitnehmer tatsächlich beim Einsatzort
übernachtet hat.
Das steuerfreie Nächtigungsgeld beträgt
ohne Nachweis der Höhe der Nächtigungskosten: 17 EUR (pauschal für
Nächtigungsaufwand einschließlich Frühstück)
werden die Nächtigungskosten sowie die Kosten des Frühstücks durch einen
Beleg nachgewiesen, so können diese vom Arbeitgeber in voller Höhe ersetzt
werden.

|  |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |


## Page 14

Bei einer Dienstreise zu einem Arbeitsort, bei der der Arbeitnehmer so weit weg von
seinem ständigen Wohnort (Familienwohnsitz) arbeitet, dass ihm eine tägliche
Rückkehr nicht zugemutet werden kann (in der Regel ab einer Entfernung von 120
km), geht die Finanzverwaltung davon aus, dass der Arbeitsort (Einsatzort) nach
einem Zeitraum von sechs Monaten zum Mittelpunkt der Tätigkeit wird. Ab dem
siebenten Monat gezahlte pauschale Nächtigungsgelder sind daher steuerpflichtig.
Mit Beleg nachgewiesene und tatsächlich bezahlte Nächtigungskosten (inkl.
Frühstück) können hingegen grundsätzlich zeitlich unbegrenzt steuerfrei ersetzt
werden.
Kostenlos zur Verfügung gestellte Nächtigungsmöglichkeiten schließen die
steuerfreie Behandlung durch den Arbeitgeber aus. Bei bloßer
Nächtigungsmöglichkeit in einem Fahrzeug (Lkw, Bus) bleibt das pauschale
Nächtigungsgeld aber im Hinblick auf zusätzliche mit einer Nächtigung verbundenen
Aufwendungen (wie z.B. für Dusche und Frühstück) steuerfrei, wenn tatsächlich
genächtigt wird.
Lohnsteuerliche Behandlung von Auslandsdienstreisen
Tagesgelder
Für Auslandstagesgelder gelten für jedes Land eigene steuerfreie Höchstsätze
(siehe Infoseite Auslandsreisekostensätze).
Seit 1.1.2008 erfolgt die Berechnung der steuerfreien Tagsätze für Auslandsreisen
gleich wie bei Inlandsdienstreisen: Ab drei Stunden steht für jede angefangene
Stunde ein Zwölftel des jeweiligen Auslandssatzes zu.
Bei Auslandsdienstreisen kommt es bei einem bezahlten Geschäftsessen pro Tag zu
keiner Kürzung der Tagsätze. Werden an einem Tag zwei Essen bezahlt, dann
kommt es zu einer Kürzung von 2/3, sodass nur noch 1/3 steuerfrei zustehen.
Nächtigungsgelder
Kostenersätze für die Nächtigung und Frühstück sind im nachgewiesenen höheren
Ausmaß steuerfrei zu berücksichtigen. Alternativ ist es aber auch möglich, die
amtlichen
Auslandsreisesätze für die Nächtigung steuerfrei zu berücksichtigen (siehe Infoseite
Auslandsreisekostensätze).
Abgabenrechtliche Behandlung der steuerfreien Reiseaufwendungen
Sofern die Tages- und Nächtigungsgelder lohnsteuerfrei zu behandeln sind, sind
diese auch von der Sozialversicherung, vom Dienstgeberbeitrag zum
Familienausgleichsfonds (DB), vom Zuschlag zum DB und von der Kommunalsteuer
befreit.

## Page 15

Vorsteuerabzug bei Reisekosten
Ein Vorsteuerabzug ist solange möglich, als die Ersätze an den Dienstnehmer
lohnsteuerfrei ausbezahlt werden dürfen. Diese Regelung gilt auch für
Dienstreisebegriffe, welche ein Kollektivvertrag definiert.
Voraussetzungen für den Vorsteuerabzug sind somit:
Erstattung der Reisekosten an den Dienstnehmer
Lohnsteuerfreiheit der Reisespesen
Vorliegen einer Dienstreise (= Verlassen des Werkgeländes), wobei die
Dienstreise-Definition des Einkommensteuergesetzes oder des entsprechenden
Kollektivvertrages heranzuziehen ist
Die Reise muss im Inland durchgeführt werden
Über die Reise muss ein (Eigen-) Beleg ausgestellt werden (sofern nicht
entsprechende Aufzeichnungen in der Lohnverrechnung vorhanden sind)
Die Tages- und Nächtigungsgelder sind Bruttobeträge aus denen die abziehbare
Vorsteuer herauszurechnen ist.
Berechnung der Vorsteuer
Taggeld Inland (max. € 30 EUR) X 9,09% =
2,73 EUR
Vorsteuer
Nächtigungsgeld (max. € 17 EUR) X 9,09% =
1,55 EUR
(oder die tatsächliche Vorsteuer laut Rechnung)
Kilometergeld für die Benutzung eines privaten Kraftfahrzeuges
Bei der Benutzung eines privaten Fahrzeuges kann für eine Dienstfahrt höchstens
das amtliche Kilometergeld in Höhe von 0,42 EUR pro betrieblich gefahrenen
Kilometer, maximal jedoch 12.600 EUR pro Jahr steuerfrei verrechnet werden. Damit
sind sämtliche Kosten im Zusammenhang mit der betrieblichen Nutzung des KFZ
abgegolten.
Voraussetzung für die steuerfreie Behandlung der Kilometergelder ist die genaue
fortlaufende Führung eines Fahrtenbuches oder eines anderen gleichwertigen
Nachweises.

|  |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |
`,
    "pageCount": 1,
    "icps": [
      "Global People"
    ],
    "metadata": {
      "title": "Austria",
      "version": "1",
      "parsedDate": "2026-01-26T17:31:53.308Z",
      "parserUsed": "Textract",
      "sourceFile": "Expenses Austria.pdf",
      "effectiveDate": "2026-01-26T06:33:08"
    }
  },
  "Italy": {
    "name": "Italy",
    "code": "IT",
    "policyMarkdown": `

## Page 1

Expense Reimbursement Overview - Italy
Introduction
An expense reimbursement process allows you to reimburse your workers for situations where
they have used their own funds to cover business-related items.
Expense reimbursement rules, taxation laws and claims process vary greatly under each
country's employment legislation and company policies. It is thus very important that you
familiarize yourself with the expense process and rules that apply under the service and the
Local Employer to ensure that your workers have their expense claims reimbursed in a timely
manner.
The guidelines in this document are to ensure you have all the information you need to submit
your workers expense reimbursement claims, avoiding delays due to incorrect filing. Our
information is based on local laws of each country and the filing process applied under the
service and the Local Employer.
All approved expenses will be paid as NET to the employee and grossed up if they are not tax-
free.
The below rules apply to locally based and paid workers.
Expense Reimbursement Process Steps
All expenses reimbursement claims should be submitted in accordance with the the service
process:
1. Familiarize your worker on how to report their expenses. It is important that you
determine with the worker an internal process and expense policy so that they know
the method and deadline for submitting expense claims to their Line Manager and
how.
2. Review submitted expense reports and approve expense claims, ensuring all required
supporting documents have been included e.g. receipts, invoices, by the agreed cutoff
date.

## Page 2

3. the service will share the submitted report with the Local Employer for processing and
reimbursement.
4. Expense reimbursements will be processed along the salary and will be reflected in
the worker's pay slip.
Expense Reimbursement Rules
There are many different types of expenses with different requirements and tax rules that must
be followed to ensure workers are reimbursed correctly and without delay.

## Page 3

Supporting Documents
- Clear and readable receipts and invoices
must be submitted with expenses.
- Online copies are sufficient scanned not
photo , a hard copy is not required.
- Without these documents any applicable
tax exemption cannot be applied.
- Documents must be actual tax receipts
or invoices preferably scanned not photos;
booking confirmations will not suffice.
- The Local Employers name and details
should appear on invoices, not the
workers. For EXAMPLE::
<Global People
Global People s.r.l.,
Via Venti Settembre 3,
Torino (TO) CAP 10121, Italy
VAT: IT12455930011
C.F: 12455930011
<GoGlobal
GoGlobal Consulting S.r.l
Via Uberto Visconti Di Modrone 38
20122 Milano, Italia
P.IVA 12205930964
- The exception to the above is where it is
not possible to use the Local Experts name
e.g. on flight tickets/ hotels, in which case
the workers name and details should be
used the end client shouldn't not be
mention.
- Any personal information not required for
reimbursement purposes should be
removed before it is submitted.

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |


## Page 4

- Business Trip - submit a separate report
for each trip.
- Submitting Milage claims, The amount of
the refund varies depending on the type of
car (model, year,
fuel etc) full details of the vehicle and
proof of distance travelled should be
provided as well (e.g. google maps).
- All approved expenses will be paid as
NET to the employee and grossed up if
they are not tax free.
- Receipts should be submitted with the
same currency and clear exchange rate.

## Page 5

Business Expenses (Non-Travel)
- Business expenses related to workers
completing their job will usually be tax
exempt. Other expenses are subject to
varying tax rules.
- Only purely business related elements of
this expense will be tax free, anything
additional will be subject to tax.
- Tax exemptions will only be applied
providing sufficient proof is shared e.g. tax
receipts, invoices etc
- Online copies of invoices and receipts
are sufficient, a hard copy is not required.
- All expense that has been approved by
the client as a business expense will be
NET to the employee (grossed up if not tax
free).
- Meals offered to a client/supplier is
labeled as "spese di rappresentanza"
(entertainment expenses) and is tax free
up to 75% of the whole amount. The
worker will always need to mention the 3rd
party detail.
- You cannot mix per diem method with
actual expenses. You will need to agree
with the worker on one method per
business trip.
- Additional excepted expense items
include:
*Employee engagement activity
*Training and development
*Car Rental up to 15 days (Car Rental
longer than 15 days will be subjected to
taxes)

|  |  |
| --- | --- |


## Page 6

Mileage
- Mileage can be claimed when using a
private vehicle for work purposes.
- The rate applied is a conventional value
fixed by Italian Automobile Club d'Italia
(A.C.I) according to the brand, model,
petrol or diesel and all other characteristics
of the car (workers with a recognized
digital access ID can view the rates the
Mileage costs - ACI.
- The following details must be listed in
the expense report:
-Car details (the type of car, whether petrol
/ electric / hybrid, model).
-Information regarding the route and the
kilometers traveled, which must be
reported with indication of the starting point
and arrival point.
-Scan of the card passport (libretto di
circolazione), as it will contain all
information regarding the car owner.
-Any screenshot from any app that can
track start point, arrival point and KM will
work (like google maps) to keep track of
the travelled KM.
- The maximum limit for a mileage claim to
be non-taxable is 15,000 Kilometers. Any
excess kilometers will be subject to tax.
- Expenses linked to vehicles i.e. fuel,
parking, toll charges, are tax exempt up to
20% of their costs as long as the car is not
assigned to a specific employee e.g. a
rental car.
- Transportation expenses are 100% tax
exempt if the worker provides evidence of
the transportation documents (not
applicable for company cars).

## Page 7

- Parking fees are excluded from the per
diem rate and should be reimbursed
against receipts.
- Fuel expenses are taxed.

## Page 8

Business Travel (Domestic)
- Domestic business trips are applicable
for travel 60 kilometers or more outside the
municipal area of the worker.
- Domestic business trips have set per
diem rates (Article 51 of the Labour Code)
in place to cover meals and
accommodation, exempt from tax as long
as supporting documents such as receipts
are provided.
- The current per diem rate for trips with no
hotel or meal provision is €46.48 per day.
- If either meals or hotels are provided to a
worker the per diem rate will be reduced to
€30.99 per day.
- If both meals and hotels are provided to
the worker the per diem rate will a reduced
to €15.49 per day.
- Trips within a workers municipal area are
subject to a tax exemption of 75% on the
per diem rate.
- Per diem amounts may vary according to
NCBA. For Commercio NCBA for example,
in case of business trip with no overnight
stay, per diem will be reduced by 1/3.
- Employees in Italy can request tax-free
reimbursement for car rental/leasing for up
to 15 days. - Any duration beyond 15 days
will be subject to taxation.
- Under the new provisions contained in
Article 10 of the Budget Law 2025, there is
an obligation to use traceable payment
methods for all business expenses during
travel, which includes:
- Bank transfers
- Postal transfers
- Credit cards
- Debit cards

|  |  |
| --- | --- |


## Page 9

- Prepaid cards
- Bank or cashier's checks
- If reimbursements are not made via
these traceable methods they will not be
considered deductible.

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |


## Page 10

Business Travel (International)
- International business trips can
reimbursed using the per diem method
(Article 51 of the Labour Code) applying a
set rate towards the cost of meals and
accommodation tax free.
- The current per diem rate for trips with no
hotel or meal provision is €77.46 per day.
- If either meals or hotels are provided to
the worker the per diem will be reduced to
€51.65 per day.
- If both meals and hotels are provided to
the worker the per diem will be reduced to
€25.82 per day.
- Workers must always provide receipts
when per diems are in place.
- Items outside of the per diem are not
subject to any set maximum to be
considered tax free and should be paid as
expenses against supporting documents
such as receipts.
- Long term trips: for missions lasting over
a month, the allowance is reduced by 10%.
- Per diem amounts may vary according to
NCBA. For Commercio NCBA for example,
in case of business trip with no overnight
stay, per diem will be reduced by 1/3.
- Under the new provisions contained in
Article 10 of the Budget Law 2025, there is
an obligation to use traceable payment
methods (such as credit cards, debit cards,
or bank transfers) for all business
expenses during travel. If reimbursements
are not made via these methods, they will
not be considered deductible for the
company.

## Page 11

- Under the new provisions contained in
Article 10 of the Budget Law 2025, there is
an obligation to use traceable payment
methods for all business expenses during
travel, which includes:- Bank transfers-
Postal transfers- Credit cards- Debit cards-
Prepaid cards - Bank or cashier's checks
- If reimbursements are not made via
these traceable methods, they will not be
considered deductible.
Disclaimer:
Please note this is a general guide to help you understand the process of Expense
Reimbursement according to the laws of your country of employment and the process
requirements through your Local Employer and the service Global.

## Page 12

These guidelines aim to help you efficiently manage the expense reimbursement process,
ensuring seamless and compliant reimbursements while avoiding unnecessary taxes..
To correctly classify expenses on your payslip, please follow these guidelines. Failure to
provide the required information or documents will affect our ability to process expenses
properly.
WHAT DO WE NEED TO PROCESS YOUR EXPENSES?
1. Expense Report: Must include all relevant information:
Date
Description: Clearly state what the expense is for to allow internal approval
and verification of its business relevance. For example, instead of just "AI
Rockstars" write "Trip to attend AI conference to close deal X and Y" for clarity.
Context: Explain the context and how it relates to your business activities.
Mismatched Amounts: If the expense amount differs from the invoice amount,
explain the discrepancy. Unexplained mismatches will lead to rejection.
Conversion Rate: Indicate the conversion rate if the invoice is in a different
currency than your salary.
Excel Format: Preferred (can be exported from your expense management
system).
Important!!! Business Trip: submit a separate report for each trip.
Include the location and the duration if the trip.
2. Supporting Documents:
Provide matching invoices/receipts (VAT documents) for reimbursement.
Invoice/Receipt Identification: Should have the word "invoice" or "receipt,"
include a description of the expense, show a payment was made and a
VAT/Tax number.
Ensure the document is legible and intact
For invoices in a language other than English or your local language, ensure
we can identify the corresponding expense (e.g., write the expense on the
invoice).
Only invoices/receipts are acceptable; other evidence like credit card slips,
bank statements, booking confirmations, or screenshots of restaurant orders
will not be approved.
W

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |


## Page 13

Business Expenses (paid as net)
Comment
Flight
Hotel
Up to cap
Per Diem
Up to cap
Unless per diem is paid and only if
Personal Meals
during a business trip
Meals with clients
Transportation
Mileage
During business trips
Parking
During business trips
Tolls
During business trips
Additional Expenses (paid as net)
IT equipment necessary for the
performance of the work
Only if invoice issues to Global People
Professional conferences
Only if invoice issues to Global People
Need a written declaration that this
Phone bill-
phone uses only for business purposes.
Taxable Expenses
Phone Bills
Mixed use
Internet
Mixed use
Meals with Colleagues

|  |  |
| --- | --- |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
|  |  |
`,
    "pageCount": 1,
    "icps": [
      "Global People",
      "GoGlobal"
    ],
    "metadata": {
      "title": "Italy",
      "version": "1",
      "parsedDate": "2026-01-26T17:45:25.316Z",
      "parserUsed": "Textract",
      "sourceFile": "Expense Reimbursement Overview â Italy.pdf",
      "effectiveDate": "2026-01-26T06:33:09"
    }
  },
  "Switzerland": {
    "name": "Switzerland",
    "code": "CH",
    "policyMarkdown": `

## Page 1

Expense Reimbursement Overview
Last updated: Dec 17, 2024
Switzerland
Introduction
An expense reimbursement process allows you to reimburse your workers
for situations where they have used their own funds to cover business
related items.
Expense reimbursement rules, taxation laws and claims process vary
greatly under each country's employment legislation and company policies.
It is thus very important that you familiarize yourself with the expense
process and rules that apply under the service provider and the Local Employer to
ensure that your workers have their expense claims reimbursed in a timely
manner.
The guidelines in this document are to ensure you have all the information
you need to submit your workers expense reimbursement claims, avoiding
delays due to incorrect filing. Our information is based on local laws of
each country and the filing process applied under the service provider and the Local
Employer.
All approved expenses will be paid as NET to the employee and grossed up
if they are not tax-free.
The below rules apply to locally based and paid workers.
Expense Reimbursement Process Steps
All expenses reimbursement claims should be submitted in accordance
with the the service provider process:
1. Familiarize your worker on how to report their expenses. It is important
that you determine with the worker an internal process and expense
policy so that they know the method and deadline for submitting
expense claims to their Line Manager and how.
2. Review submitted expense reports and approve expense claims,
ensuring all required supporting documents have been included e.g.
receipts, invoices, by the agreed cutoff date.
3. the service provider will share the submitted report with the Local Employer for
processing and reimbursement.
4. Expense reimbursements will be processed with the monthly payroll run
and will be reflected in the worker's pay slip.

## Page 2

Expense Reimbursement Rules
Please use the attached form when submitting expenses:
Travel Expense Report Template Switzerland CHF .xlsx
There are many different types of expenses with different requirements and
tax rules that must be followed to ensure workers are reimbursed correctly
and without delay.
Supporting Documents
Receipts and invoices must be submitted alongside
expense items.
Documents must be actual tax receipts or invoices; booking
confirmations will not be sufficient
The Local Employer's name and details should appear on
invoices:
Global PPL CH GmbH
Freigutstrasse 2 8002 Zürich, Switzerland
CHE-295.369.918
The exception is when it is not possible to use the Local
Employers name, e.g. on flight bookings. The workers name
should then be used instead.
Without the correct supporting documents any applicable
tax exemption cannot be applied.
Workers should keep all their expenses in a simple report of
their choice.
All approved expenses will be paid as NET to the employee
and grossed up if they are not tax free.
Any personal information not required for reimbursement
purposes should be removed before it is submitted.
The receipts/ invoices should be reported In the local
currency the worker will need to add the FX rate they have
used to calculate the expense.
Workers should submit a separate report per each business
trip.
Business Expenses (Non-Travel)
Business expenses related to workers completing their job
are usually tax exempt. Other expenses are subject to
varying tax rules.
Tax exemptions will only be applied providing sufficient
proof is shared e.g. tax receipts, invoices etc.
Expenses which are business related e.g. laptops, office
supplies, etc. will be tax free providing sufficient proof

|  |  |
| --- | --- |
|  |  |


## Page 3

(proof, invoices etc.) is included.
Only purely business related elements of this expense will
be tax free, anything additional will be subject to tax.
Smaller business expenses tax-free can be reimbursed
against receipts ( e.g. expenses that occur during a
business trip) of a maximum of CHF 20.
The Local Employer's name and details should appear on
invoices.
Online copies of invoices and receipts are sufficient, a hard
copy is not required.
Training expenses require the approval of the direct
manager.
Mileage
Workers using private vehicles, including cars, vans,
motorbikes and bicycles for work purposes should be
reimbursed according to the mileage travelled.
There are official mileage rates set which should be
followed. The current rates can be found (Abzug für die
Benützung eines privaten Fahrzeugs ab dem Steuerjahr
2016) here
Mileage can be submitted as any other expense claim
except that no receipts are required since this expense is
based on usage rather than bills / invoices / receipt /
logbook.
Workers using private vehicles, including cars, vans,
motorbikes and bicycles, for work purposes should be
reimbursed according to the mileage travelled. A logbook is
requried for each used car.
Our local partner reimbursed mileage per calculation
method based on route, car details and destination, the
worker will need to share a map with the relevant route
( google maps is sufficient
If a worker uses more than one vehicle in a year the
mileage will all be calculated based on a combined mileage
total.
Business Travel (Domestic)
Domestic business trips have set per diem rates to cover
meals.
Breakfast is set at CHF 15.00, Lunch at CHF 35.00, Dinner
at CHF 40.00.
Per diem can be paid upon the workers return, it does not
need to be paid in advance.
Employers can also choose not to use per diems and

|  |  |
| --- | --- |
|  |  |
|  |  |


## Page 4

instead reimburse meals against receipts.
Additional costs should be reimbursed as expenses against
receipts and invoices.
Business Travel (International)
International business trips can be reimbursed by using the
per diem method to apply a set allowance tax free towards
meals.
These rates are set by the Swiss Tax Conference
(association of cantonal tax authorities) as follows:
Breakfast is set at CHF 15.00, Lunch at CHF 35.00, Dinner
at CHF 40.00.
It is possible to increase the daily per diem rate, however,
any portion of the per diem amount that exceeds the set
rate will be taxable and must have a receipt provided with it.
Per diem can be paid upon the workers return, it does not
need to be paid in advance.
Overnight expenses such as hotels and transport should be
reimbursed as expenses against receipts and invoices.
The Local Employer's name and details should appear on
invoices, except where this won't be possible e.g. flight
bookings.
Disclaimer:
Please note this is a general guide to help you understand the process of Expense Reimbursement according to the
laws of your country of employment and the process requirements through your Local Employer and the service
provider Global. Additional questions should be followed up through your service provider Customer Success
Manager.

|  |  |
| --- | --- |
|  |  |
`,
    "pageCount": 1,
    "icps": [
      "Global PPL CH GmbH"
    ],
    "metadata": {
      "title": "Switzerland",
      "version": "1",
      "parsedDate": "2026-01-26T18:07:22.480Z",
      "parserUsed": "Textract",
      "sourceFile": "Expense Reimbursement Overview - Knowledge Base (1).pdf",
      "effectiveDate": "2026-01-26T06:33:10"
    }
  }

};