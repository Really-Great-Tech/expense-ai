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
    "policyMarkdown": "\n## Page 1\n\nGoGlobal\nExpenses Claim\nGuidelines - Indonesia\nJanuary 2024\nThis document provides guidelines to\nGoGlobal workers on submitting expense\nclaims compliantly\n\n## Page 2\n\nRoles and Responsibilities\nEmployee\nClient\nGoGlobal\nTo whom the employee is\nIndividuals hired by GoGlobal\nEmployer of Record\ndispatched or assigned\nObtain the valid and correct receipts\nReview the submitted expenses to ensure\nValidate the receipts submitted by the\nthat have all the correct and needed\nEstablish clear business purpose of all\nemployee according to local regulations.\ninformation and have a clear business\nincurred expenses\nFollow up on missing or questionable\npurpose.\nSubmit expense claims with clear and\nreceipts, postpone or reject\nShare with GoGlobal, the approved\nlegible copies of the receipts to Client\nreimbursements if required for\nexpenses per worker before the payroll cut\nline manager for approval preferably\ncompliance and taxability.\noff date to process them in the same month.\nwithin the same month of the expense.\nSettle reimbursement based on the\nThe expense submission must have an\nBe compliant with the local guidelines.\nitemized report along with clear receipts\napproved expense submission by the\nclient and verified receipts.\n2\nGoGlobal\n\n|  |  |  |  |  |\n| --- | --- | --- | --- | --- |\n|  |  |  |  |  |\n|  |  |  |  |  |\n\n\n## Page 3\n\nOption 1: Employees using GoGlobal's Expenses System (Zoho)\nPreferred and most common choice\nEmployees submit the\nClient line manager\nGoGlobal fetches the\nexpenses in the Zoho\nreviews and approves\napproved expenses from\nsystem along with\nthe expenses by the\nexpenses system,\nproperly labelled\nmonthly payroll cutoff\nperforms a thorough\nreceipts.\ndate.\nreview and processes all\nvalid expenses.\nStep 1\nStep 2\nStep 3\nPlease Note:\nThis is the preferred mode and ensures timely expense processing.\nClient does not upload expenses into GoGlobal's system (BlueOcean), GoGlobal does it on their behalf.\n3\nThe expenses approved after the payroll cutoff date are processed in the following month.\nGoGlobal\n\n|  |  |  |  |  |\n| --- | --- | --- | --- | --- |\n\n\n## Page 4\n\nOption 2: Employees using Client's Expenses System or GoGlobal's\nExpense template\nNot a preferred option but accepted\nEmployees submit the\nClient line manager\nClient uploads the\nGoGlobal reviews the\nexpenses along with\nreviews and approves the\napproved expenses with\nsubmitted expenses and\nproperly labeled receipts\nexpenses.\nitemized expense reports\nprocesses all valid\nor GoGlobal's Expense\nexpenses.\nto the Client for approval.\nTemplate to BlueOcean\npayroll instructions along\nwith expenses receipts.\nStep 1\nStep 2\nStep 3\nStep 4\nPlease Note:\nExpenses submitted without itemized reports or properly labeled receipts will be rejected or postponed.\n4\nThe expenses submitted after the payroll cutoff date are processed in the following month.\nGoGlobal\n\n|  |  |  |  |  |  |  |\n| --- | --- | --- | --- | --- | --- | --- |\n\n\n## Page 5\n\nWhat comprises a clear expense submission\nClear and legible\nConvert amount in\nFor Mileage\nreceipts, with total\nlocal currency and\nreimbursements,\nInclude details (date\nCorrect\namount matching the\nInclude currency &\ninclude To and Fro\nof expense, business\ncategorization of the\nreceipts, labeled\nexchange rate used\nlocations, distance\npurpose, and\nincurred expense\nproperly for\nfor foreign currency\ntravelled and per diem\nmerchant name)\nidentification.\nexpenses\nrates.\nPlease note that GoGlobal only reimburses the clear expense submission that are approved by the Client. GoGlobal holds the right to reject or postpone\npayments if the expenses submissions do not follow the above listed criteria or are submitted post the payroll cutoff shared with the Client.\n5\nGoGlobal\n\n|  |  |  |  |  |  |  |\n| --- | --- | --- | --- | --- | --- | --- |\n\n\n## Page 6\n\nExpense Categories\nAccepted Expenses\nNon-reimbursable Expenses\nTravel expenses (including Baggage claim, meals\nExpenses for spouses, partners, and other family\nand accommodation)\nmembers.\nWork-related supplies (e.g., stationery, photocopy)\nPersonal expenses (any non-business-related\nWork related equipment\nexpenses).\nDues, subscriptions, and professional licenses\nExpenses without suitable invoice/receipt or\nsupporting document are illegible.\nShipping & postage\nAny casual emolument or benefit attached to an\nTransportation for business (Taxi, Grab, Train,\noffice or position in addition to salary or wages,\nAirfare) - mileage report\n(e.g., salary of house help, gas, water, or electricity\nClient or customer visits\nbills, school fees, personal travel.)\nTraining and development\nConference and business events\nExpenses that fall under taxable income will be treated as per the local regulations.\n6\nGoGlobal\n\n|  |  |\n| --- | --- |\n|  |  |\n|  |  |\n|  |  |\n|  |  |\n|  |  |\n|  |  |\n\n\n## Page 7\n\nExpense Benefits In Kind (BIK)\nBIKs (Taxable)\nNon-BIKs (Non-Taxable)\nReimbursement of airfare ticket for personal trip (e.g.., expatriate\nReimbursement of airfare ticket for business trip\nemployee, as per employment contract - round trip ticket to home\ncountry, provided by the employer)\nBusiness lunch/ entertainment with client/ prospect\nclient/vendor\nMobile phone bills/credit; internet billing\nReimbursement of purchasing the office supplies\nPersonal Meals during business trip\nReimbursement of car rental used during business\nCar rental dedicated for employee and the car is parked at the\ntrip\nemployee's home (not parked in the office)\nReimbursement of trainings\nReimbursement of fuel and toll from the car rental or on private car\nused.\nMeals and drinks ingredient, and/or drinks provided\nfor all employees\nReimbursement of medical claims personal\nTransportation facility provided for all employees\nMedical insurance premium (additional insurance provided to\nemployee and his/her family on top of the mandatory benefit by\nReimbursement of taxi for visiting client office,\nregulation)\ngovernment/tax office (for business purpose)\nHouse rental provided to employee\nUniform which is not related with work and safety requirement\nChild's tuition fee borne by company (e.g., for expatriate employee\n7\nGoGlobal\n\n## Page 8\n\nReceipt Requirements\nTAWAN\nMALL KUNINGAN CITY\nAddress:\nLantai UG No 50 - 50A\nAgoda Company Pte, Ltd.\nTELP (021)-2992 1879\n30 Cecil Street\nPrudential Tower #19-08\nJAKARTA\nSingapore 049712\nComponents of an expense receipt\nPOS: cashier\nCashier: Noviana\nBooking No.\nPrint Cnt:1\nPayment Date July 20, 2023\nServer: TABSQUARE\nReceipt\nDate of the Expense\nDec 27, 2023 3:12:39 PM\nPAX: 3\nCustomer Name & Address\nTBL 24\nGuest\nName\nNAME\nPhone:\nBilling Address\nExpense type / Description\nREF: TABSQUARE: 707518985\nEmail Address\n1 Mie Goreng Spesial Ulang Tahun\n42,000\n1 Jamur Enoki Goreng Garing (DITA)\n42,000\nDescription\nAmount\n1 Bayam Jepang Tiga Telur (DITA)\n60,000\nTotal Amount of the expense\n1 Bubur Polos (DITA)\n22,000\nHotel Name\nHotel Kuretakeso Kemang\n1 Teh Madu Dengan Goji Berry Dan L\n42,000\nPeriod\nJuly 20, 2023 July 21, 2023 night(s)\n1 Ayam Rebus Hainan 1 Ekor (DITA)\n120,000\n1 Cakue (DITA)\n12,000\nRoom Type\nExecutive King Room\nName of the Vendor / Merchant\n1 Take Away Charge\n4,545\n# of Rms.\n1\nTotal Item : 8\nTotal Qty : 8\n# of Extra Beds\n0\nSubtotal\nTotal Room Charges\nUSD 42.23\nVAT amount, listed clearly on the Invoice (if applicable)\n344,545\nService charge\n18,950\nTotal Extra Bed Charges\nUSD 0.00\nTax Resto 10%\n36,349\nTotal\nDiscount\nUSD-1.75\n399,844\nName of clients/vendor in the expense report for business\nGRAND TOTAL\nUSD 40.48\nmeal with clients/vendor*\nPrinted Dec 27, 2023 3:44:17 PM\nTotal Charge\nIDR 602,933 (USD 40.48)\n8\nGoGlobal\n\n|  |  |\n| --- | --- |\n|  |  |\n|  |  |\n|  |  |\n\n\n|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n\n\n|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n|  |  |  |\n\n\n|  |  |\n| --- | --- |\n|  |  |\n|  |  |\n|  |  |\n\n\n## Page 9\n\nWhat can delay/ reject reimbursements?\n$\n$\n!\n€\nIf the expense\nIf one or more of the\nIf the business\nExchange rates\nSubmissions do not\nreceipts total do not\nreceipts are invalid\npurpose of expenses\nand/or exchange\nfollow the format\nmatch the submitted\nor unreadable.\ncannot be\ncurrency missing for\nadvised by GoGlobal\nexpense amount.\nestablished or they\nexpenses incurred in\nfall under a taxable\nforeign currency\nallowance/personal\nexpense.\n9\nGoGlobal\n\n## Page 10\n\nGoGlobal\nThank You",
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
  }

};