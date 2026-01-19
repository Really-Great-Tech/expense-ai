/**
 * Country Policy Seed Data
 *
 * This file contains embedded seed data for country expense policies.
 * Consolidated from individual JSON files.
 *
 * DO NOT EDIT MANUALLY - Use the original JSON files if updates are needed
 */

export const COUNTRY_POLICY_SEEDS: Record<string, {
  receiptStandards: Array<{
    required_data: string;
    travel_non_travel_both: string;
    expense_type: string;
    icp_name: string;
    mandatory_optional: string;
    rule: string;
  }>;
  compliancePoliciesGrossUpRelated: Array<{
    travel_non_travel_both: string;
    expense_type: string;
    icp_name: string;
    gross_up: boolean;
    gross_up_rule: string;
  }>;
  compliancePoliciesAdditionalInfoRelated: Array<{
    travel_non_travel_both: string;
    expense_type: string;
    icp_name: string;
    additional_info_required: boolean;
    additional_info_rule: string;
  }>;
}> = {
  "Austria": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People IT-Services GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show supplier business name"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People IT-Services GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show transaction date"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People IT-Services GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show total amount"
      },
      {
        "required_data": "ICP company details",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training, Utilities, Professional services",
        "icp_name": "Global People IT-Services GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice must show Global People IT-Services GmbH, Kärntner Ring 12, A-1010 Vienna, Austria VAT ID: ATU77112189 - The Local Employers name and details should appear on invoices, not the workers"
      },
      {
        "required_data": "Employee name as guest/traveler",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "Global People IT-Services GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Hotel/flights invoices should indicate the name of the worker not the end client"
      },
      {
        "required_data": "Tax receipt or invoice format",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People IT-Services GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Documents must be actual tax receipts or invoices; booking confirmations will not suffice"
      },
      {
        "required_data": "Kilometers traveled",
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People IT-Services GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "To claim mileage, a record of kilometers traveled must be submitted"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Utilities, Professional services",
        "icp_name": "Global People IT-Services GmbH",
        "gross_up": false,
        "gross_up_rule": "Business expenses related to workers completing their job will usually be tax exempt"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Training",
        "icp_name": "Global People IT-Services GmbH",
        "gross_up": true,
        "gross_up_rule": "All expenses that has been approved by the client as a business expense will be NET to the employee (grossed up if not tax free)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People IT-Services GmbH",
        "gross_up": true,
        "gross_up_rule": "Maximum €0.42 per betrieblich gefahrenen kilometer, maximum €12,600 per year steuerfrei. Parking tickets taxed if paid outside of Mileage payment"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "Global People IT-Services GmbH",
        "gross_up": true,
        "gross_up_rule": "Lodging should be paid separately upon receiving the proper invoice/receipt or €15 without a receipt. With proper receipt can be reimbursed in full tax-free"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People IT-Services GmbH",
        "gross_up": true,
        "gross_up_rule": "Domestic: maximum €26.40 per day tax-free (12 hours maximum). If meals provided by employer/host, per diem reduced by 50%. International: government per diem rates apply, daily rate may be increased but receipt required for amount above set rate to be tax-exempt"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Entertainment, Medical",
        "icp_name": "Global People IT-Services GmbH",
        "gross_up": true,
        "gross_up_rule": "Other expenses are subject to varying tax rules. All approved expenses will be NET to employee (grossed up) if not tax free"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Training",
        "icp_name": "Global People IT-Services GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Training expenses require the approval of the direct manager"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People IT-Services GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Travel reporting template must be submitted. Map with the relevant route (google maps is sufficient) required. Voraussetzung für die steuerfreie Behandlung der Kilometergelder ist die genaue fortlaufende Führung eines Fahrtenbuches oder eines anderen gleichwertigen Nachweises"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant, Hotel, Flight",
        "icp_name": "Global People IT-Services GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Travel expenses must be submitted using the travel report template"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People IT-Services GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Domestic business trips: per diem entitlement for workers who travel more than 25 kilometres from their place of business. Per diem method cannot be mixed with actual expenses - need to agree with worker on one method per business trip"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People IT-Services GmbH",
        "additional_info_required": true,
        "additional_info_rule": "International business trips: per diem method cannot be mixed with actual expenses - need to agree with worker on one method per business trip. If lunch and dinner are provided on trip, per diem allowance reduced by two thirds"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People IT-Services GmbH",
        "additional_info_required": true,
        "additional_info_rule": "International travel: can choose to pay worker the per diem rate in advance of the trip or upon their return"
      }
    ]
  },
  "Belgium": {
    "receiptStandards": [
      {
        "required_data": "Transaction on date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "mandatory_optional": "Mandatory",
        "rule": "Date of the expense must be clearly visible on the receipt. Invoices must include the date on which the expenditure was made"
      },
      {
        "required_data": "Expense type description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "mandatory_optional": "Mandatory",
        "rule": "Expense type or description of goods/services purchased must be shown on the receipt"
      },
      {
        "required_data": "Total amount",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "mandatory_optional": "Mandatory",
        "rule": "Total amount of the expense must be clearly displayed on the receipt"
      },
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "mandatory_optional": "Mandatory",
        "rule": "Name of the vendor or merchant must be visible on the receipt. Invoices must include the identity of the supplier/trade"
      },
      {
        "required_data": "Purchaser details",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "mandatory_optional": "Mandatory",
        "rule": "Invoices must include the purchaser details"
      },
      {
        "required_data": "Itemized description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "mandatory_optional": "Mandatory",
        "rule": "Invoices must include itemized description of each purchase/expenditure"
      },
      {
        "required_data": "VAT amount",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "mandatory_optional": "Optional",
        "rule": "VAT amount must be listed clearly on the invoice if applicable"
      },
      {
        "required_data": "Worker name on invoice",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "Baldock",
        "mandatory_optional": "Mandatory",
        "rule": "The workers name and details should appear on invoices, not the Local Employer"
      },
      {
        "required_data": "GoGlobal Europe GmbH company details",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "GoGlobal Europe GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice in the name of the employee or GoGlobal Europe GmbH, Prielmayerstr. 3 80335 Munich Allemagne. Invoices must use GoGlobal's details: GoGlobal Europe GmbH, Prielmayerstr. 3, 80335 Munich, Allemagne"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office_supplies, Equipment, Training",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "gross_up": false,
        "gross_up_rule": "Business expenses related to workers completing their job will usually be tax exempt. Home office equipment, tools and supplies are considered tax exempt"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "gross_up": false,
        "gross_up_rule": "IT tools including mobile phone subscription and home broadband are considered tax exempt"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "gross_up": false,
        "gross_up_rule": "Business-related travel expenses including transportation costs, meals, hotels, exceptional and justified business costs are tax exempt"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "gross_up": false,
        "gross_up_rule": "Business meals are tax exempt"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "gross_up": true,
        "gross_up_rule": "Mileage compensation for professional travel €0.428 per km as of 01.07.2023 until 30.06.2024, not taxable if does not exceed allowance State grants to its staff, valid only if number of kilometres driven annually is not abnormally high (maximum 24,000 km/year)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "gross_up": true,
        "gross_up_rule": "Travel from work to home: amount of reimbursement may not exceed sum of EUR 0.15 per kilometer of distance, calculated on basis of outward and return distances"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Entertainment",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "gross_up": true,
        "gross_up_rule": "Entertainment expenses are considered non-tax exempt including nightclubs, cocktail lounges, theaters, country clubs, golf and athletic clubs, sporting events, hunting and fishing"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Business purpose must be established and clearly documented for all expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Documents must be actual tax receipts or invoices; booking confirmations will not suffice"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Online copies are sufficient, a hard copy is not required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Employee's line manager approval required before payroll cutoff date"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Itemized expense reports required along with clear receipts"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "For foreign currency expenses, convert amount to local currency and include currency and exchange rate used (e.g., https://www.xe.com)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "For mileage reimbursements, use GoGlobal mileage log report, include To and From locations, distance travelled and applicable mileage rates as per the log"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "For business related travel, employee must be able to prove by means of invoices, notes, receipts, etc. that the number of kilometres and the amount of car expenses are correct"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "GoGlobal Europe GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Go Global- An A1 certificate is required when travelling with an extra costs"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before submission"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Expenses must be pre-approved by Line Manager"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Business meals: When holding business lunch meeting a list of all participants (name and company) must be provided, including person hosting the event"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Local currency should be used on the expense reimbursement claim"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Expenses will be paid out 1 to 3 days after the monthly payroll run and will not be reflected in the worker's pay slip"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Expenses paid with the monthly payroll – last business day of the month"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal Europe GmbH, Baldock",
        "additional_info_required": true,
        "additional_info_rule": "Expenses will be paid out towards the end of the month. All approved expenses will be paid as NET to the employee and grossed up if they are not tax-free"
      }
    ]
  },
  "China": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the business name of the supplier/vendor providing the goods or services"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the date when the expense was incurred"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must display the total cost including all taxes and fees"
      },
      {
        "required_data": "Item description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must specify the goods or services purchased with detailed breakdown"
      },
      {
        "required_data": "ICP company name on fapiao",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "上海炎焰企业管理有限公司",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice title/header must be that of the Local Employer: Company Name 公司名称: 上海炎焰企业管理有限公司"
      },
      {
        "required_data": "ICP tax identification number",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "上海炎焰企业管理有限公司",
        "mandatory_optional": "Mandatory",
        "rule": "Must show Company Tax Code 纳税人识别号: 913101153123807359"
      },
      {
        "required_data": "ICP company address and phone",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "上海炎焰企业管理有限公司",
        "mandatory_optional": "Mandatory",
        "rule": "Must show Company Address and Landline 地址电话: 中国(上海)自由贸易试验区临港新片区鸿音路3156弄8号4层121室 021-62365280"
      },
      {
        "required_data": "ICP bank details",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "上海炎焰企业管理有限公司",
        "mandatory_optional": "Mandatory",
        "rule": "Must show Bank Name: 开户银行:中国工商银行股份有限公司上海漕河泾开发区支行 and Bank Account Number 银行账号: 100126630920 0329 328"
      },
      {
        "required_data": "Employee name as passenger/guest",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Train",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "mandatory_optional": "Mandatory",
        "rule": "For flights: itinerary must show employee name. For hotels: detailed bill must show guest name. For trains: ticket must show employee name"
      },
      {
        "required_data": "Employee name on telecommunications invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "mandatory_optional": "Optional",
        "rule": "Telephone/Mobile phone fapiaos can be in the name of the employee"
      },
      {
        "required_data": "VAT special invoice seal",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "mandatory_optional": "Optional",
        "rule": "Where possible, workers should collect a VAT special invoice (增值税专用发票) with special seal for invoices"
      },
      {
        "required_data": "Official tax bureau invoice number",
        "travel_non_travel_both": "Travel",
        "expense_type": "Taxi",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "mandatory_optional": "Mandatory",
        "rule": "For taxi hailing apps, only official invoice of tax bureau marked with invoice number can be used as basis for reimbursement"
      },
      {
        "required_data": "What, Where, When information",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications",
        "icp_name": "GoGlobal China",
        "mandatory_optional": "Mandatory",
        "rule": "Receipts must show: What (expense type/category), Where (place of expense), When (time of expense)"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Flight, Train, Bus, Taxi",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": false,
        "gross_up_rule": "Transportation (airline tickets, train, bus, taxi etc.) are tax exempt for both employer and worker"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": false,
        "gross_up_rule": "Hotel, Office Rent, Meeting Room Rent are tax exempt for both employer and worker"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Personal Meal during Business Trips generally not exceeding 150 RMB/day/person is tax exempt. Set rates: 1st tier cities (Beijing, Shanghai, Guangzhou, Shenzhen) 200 yuan per day (80 yuan per meal lunch/dinner), new 1st tier and 2nd tier cities 150 yuan per day (60 yuan per meal), 3rd tier cities 100 yuan per day (40 yuan per meal). Meals exceeding limit treated as entertaining customers or reimbursed after withholding personal income tax"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Fuel fees on cars not owned by employer: Usually paid as taxable Car Allowance between RMB 1.5-2.5 per KM. Common rate 1.5 to 2.5 yuan per kilometer"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Tolls, Parking fees",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Parking fees and highway tolls: Either Corporate Income Tax (25%) or Individual Income Tax applied if cannot prove expenses for entertaining customers"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Per diem (no invoices)",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Per Diem (no invoices) subject to Individual Income Tax, except for exemptions which apply to expat workers"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "International per diem",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Per diem rates subject to Individual Income tax, except for exemptions which apply to expat workers"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": false,
        "gross_up_rule": "Office Supplies (knifes, folders, toilet tissues, printer) are tax exempt for both employer and worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office equipment",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": false,
        "gross_up_rule": "Office equipment (laptops, etc.), Work-protection tools, Fixed assets/furniture/electrical appliances are tax exempt for both employer and worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Electronic products and communication equipment",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": false,
        "gross_up_rule": "Electronic products and accessories, communication equipment (routers, cell phones, except gifts to employees) are tax exempt for both employer and worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications registered under company",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": false,
        "gross_up_rule": "Telephone/communication fees on devices registered under company name are tax exempt for both employer and worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications registered under individual",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Telephone/communication fee invoices with individual name (SIM card NOT registered under company name) are subject to Individual Income Tax for worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Network IT service",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": false,
        "gross_up_rule": "Network IT service is tax exempt for both employer and worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Government-issued receipts",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": false,
        "gross_up_rule": "Government-issued receipts (visa fees etc.) are tax exempt for both employer and worker"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Entertainment service fees for team building",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Entertainment service fees for team building activities (dinners, beverages, KTV, tourist attractions, refreshments, food, cigarettes) subject to Corporate Income Tax (25%) for employer, tax exempt for worker"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Entertainment expenses with clients",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Entertainment expenses with clients (meals, beverages, spirits, tobacco, KTV, tourist attractions, refreshments) subject to Corporate Income Tax (25%) for employer, tax exempt for worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Small and medium appliances",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Small and medium-sized appliances (microwave ovens, except gifts to employees) subject to Corporate Income Tax (25%) for employer, tax exempt for worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Gifts and shopping cards for customers",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Gifts and shopping cards for customers subject to Corporate Income Tax (25%) for employer, tax exempt for worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Shopping cards and gifts for employees",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Shopping cards and red packets (Hong Bao) for employees as gifts subject to Corporate Income Tax (25%) for employer AND Individual Income Tax for worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Annual Medical Check",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Annual Medical Check subject to Corporate Income Tax (25%) for employer AND Individual Income Tax for worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Gym",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Gym expenses subject to Corporate Income Tax (25%) for employer AND Individual Income Tax for worker"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Daily cleaning and hygiene products",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Daily cleaning/hygiene products (dishwashing liquid, cosmetics) either Corporate Income Tax (25%) or Individual Income Tax applied"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Sports equipment",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Sports equipment either Corporate Income Tax (25%) or Individual Income Tax applied"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Toys",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Toys either Corporate Income Tax (25%) or Individual Income Tax applied"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Small non-commonly used appliances",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Small non-commonly used appliances (juicers) depends on specific appliance - verify before buying"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Marketing activities over CNY30,000",
        "icp_name": "GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Marketing Activity expenses with single tax fapiao amount bigger than CNY30,000 (about USD4500) without service contract may be challenged by tax bureau"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Entertainment expenses requiring corporate tax pass-through",
        "icp_name": "GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "If GoGlobal required to process entertainment expense reimbursement, involved corporate income tax (15%-25%) passed to end client"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Business expenses without proper fapiao",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "gross_up": true,
        "gross_up_rule": "Claims without proper Fapiao considered as employee income and subjected to personal income tax with monthly salary. Tax rate based on individual's accumulated annual income from 3% to 45%"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications",
        "icp_name": "上海炎焰企业管理有限公司",
        "additional_info_required": true,
        "additional_info_rule": "Original invoice and deduction sheet must be sent to Local Employer's Dalian Branch: Name: Sylvia Jiang, Office Address: 大连市高新园区高新街9号晟辉科技大厦703室, Tel.: +86 17615158127 or 0411-81760355 dial 808. Use S.F. Express paid by shipper and collect express fee invoice for reimbursement"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications",
        "icp_name": "上海炎焰企业管理有限公司",
        "additional_info_required": true,
        "additional_info_rule": "Business expenses must be submitted within 4 months from date of issuance. Invoices cannot be used across years"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "上海炎焰企业管理有限公司",
        "additional_info_required": true,
        "additional_info_rule": "Manager approval required. Submit expense reimbursement form to direct manager with Local Employer cc'd payroll.all@talentbankglobal.com, indicating total amount in email body"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "上海炎焰企业管理有限公司",
        "additional_info_required": true,
        "additional_info_rule": "Forward approved emails/documents and completed expense reimbursement template to payroll.all@talentbankglobal.com before 5th of month"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "上海炎焰企业管理有限公司",
        "additional_info_required": true,
        "additional_info_rule": "Original invoices must be submitted before 20th of month according to local employer's invoice filing guidelines"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All foreign currency expenses",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Exchange rate documentation required - use spot exchange purchase price issued by Bank of China on first working day of month after returning from business trip. Foreign currency expenses must be entered line by line according to invoices"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Hotel detailed bill required along with fapiao showing length of stay"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Flight",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Air ticket itinerary required as auxiliary certificate showing round trip air ticket, ticket itinerary. For travel agency purchases: invoice with worker name, round trip city and time period required"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Train",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Printed paper train tickets required as proof of expense. National train ticket reimbursement certificate can be printed at station ticket window and automatic ticket vending machines"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Taxi with ride-hailing apps",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "For Didi or other ride-hailing apps: trip details/itinerary required along with official tax bureau invoice. Exception: \"Didi Chuxing\" can provide \"car-hailing service fee\" invoices for express/special cars"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage with personal vehicle",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Business justification required proving expenses for entertaining customers. Personal car license plate number on invoice cannot be reimbursed directly"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Business travel subsidy rates",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Documentation of city tier classification required for per diem rates: 1st tier (Beijing, Shanghai, Guangzhou, Shenzhen), new 1st tier and 2nd tier cities listed, 3rd tier (all other cities)"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies with generic descriptions",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Detailed purchase list required if fapiao shows \"Please Refer To Detailed Purchase List\""
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Professional services over certain amounts",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Contract required between Local Employer and provider for company services (IT services, advertising agencies). Worker must contact Local Employer 5 working days in advance"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Marketing activities over CNY30,000",
        "icp_name": "GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Service contract required for marketing expenses with single fapiao amount over CNY30,000 to avoid tax bureau challenge"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Personal information removal",
        "icp_name": "上海炎焰企业管理有限公司, GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before submission"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Why and Who information",
        "icp_name": "GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Business purpose required if not shown on receipt - indicate on expense report. Business relationship to taxpayer or persons involved required if not shown on receipt - indicate on expense report"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Expense report filled out according to internal policy required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Scanned copies of receipts/fapiaos submitted to HR by 5th of each month"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Hard copy documents submitted to GoGlobal Finance Team: Room B102, Block B, Jiaozi Financial Technology Center, No. 1677, north section of Tianfu Avenue, Guixi street, Wuhou District, Chengdu, Sichuan Province, Tel: 19921181138"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal China",
        "additional_info_required": true,
        "additional_info_rule": "Fapiaos pasted on A4-sized paper in chronological order following expense claim form sequence, similar-sized fapiaos grouped on one sheet. Electronic fapiaos must be printed"
      }
    ]
  },
  "France": {
    "receiptStandards": [
      {
        "required_data": "Transaction on date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunicationns, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Date of the expense must be clearly visible on the receipt"
      },
      {
        "required_data": "Expense type description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunicationns, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Expense type or description of goods/services purchased must be shown on the receipt"
      },
      {
        "required_data": "Total amount",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunicationns, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Total amount of the expense must be clearly displayed on the receipt"
      },
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunicationns, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Name of the vendor or merchant must be visible on the receipt"
      },
      {
        "required_data": "VAT amount",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "mandatory_optional": "Optional",
        "rule": "VAT amount must be listed clearly on the invoice if applicable"
      },
      {
        "required_data": "Worker name on invoice",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "mandatory_optional": "Optional",
        "rule": "Invoice in the name of the employee or GoGlobal France. All invoices, if applicable must be set with information of the concerned worker where possible"
      },
      {
        "required_data": "Parakar company details on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "Parakar",
        "mandatory_optional": "Optional",
        "rule": "Invoices should, where possible, state \"Parakar Services France, SAS\" And Address, \"78 Boulevard de la Reine, CS90958, 78035 Versailles, CEDEX\""
      },
      {
        "required_data": "GoGlobal company details on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "GoGlobal France",
        "mandatory_optional": "Optional",
        "rule": "Invoices should, where possible state \"GoGlobal France\", 4 rue de la République 69001 Lyon, France"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office_supplies, Equipment, Training",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "gross_up": false,
        "gross_up_rule": "Many business expenses related to workers completing their job will be tax exempt. Only purely business related elements of this expense will be tax free, anything additional will be subject to tax"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "gross_up": true,
        "gross_up_rule": "Invoices for mobile phone usage can only be reimbursed tax-free if the worker uses a separate phone for personal use and can provide proof of this phone. Usually companies apply solutions: reimburse 50% of the invoices, provide IT/Communication tools for Professional use only, or provide a monthly allowance"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "GoGlobal France",
        "gross_up": true,
        "gross_up_rule": "Internet costs can be reimbursed at a flat rate of 25% of the invoice amount (tax free)"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "Parakar",
        "gross_up": false,
        "gross_up_rule": "Parakar will not reimburse internet bills in addition to the home office allowance"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "gross_up": true,
        "gross_up_rule": "Per-diems in France calculated based on number of lunches or dinners for meals and number of nights for hotels. French government sets per diem amounts per country for international travel. Employers can choose to pay above official tax-free per diem rate but amount exceeding URSSAF limit will be considered taxable salary subject to social security contributions and income tax"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "gross_up": true,
        "gross_up_rule": "Domestic business travel: meals treated as non-taxable income up to government set subsistence costs. International travel: per diem reductions apply - if hotel paid on receipt reduction by 65%, if one meal reimbursed on receipt reduction by 17.5%, if two meals reimbursed on receipt reduction by 35%"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "gross_up": true,
        "gross_up_rule": "French Government sets specific mileage rates determined by fiscal engine size expressed in CV (3 to 7). Rates vary by distance: up to 5,000 km, 5,001 to 20,000 km, beyond 20,000 km. For electric vehicles, amount is increased by 20%"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "gross_up": false,
        "gross_up_rule": "Employers must pay 50% of cost of season tickets for public transport between residence and workplace. Cost based on 2nd class fare and shortest route. This reimbursement processed through payroll and exempt from social security contributions"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Parakar",
        "gross_up": true,
        "gross_up_rule": "For alcoholic beverages: 1 glass per person at business meal allowed. When reimbursement of more drinks per person requested, right to decline whole reimbursement claim. Only wine, beer (maximum 33cl), or cider accepted. Spirits prohibited"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "GoGlobal France",
        "gross_up": true,
        "gross_up_rule": "Alcoholic Beverages can be reimbursed if approved and validated by the Client"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Business purpose must be established and clearly documented for all expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Documents must be actual tax receipts or invoices ('justificatifs'); booking confirmations will not suffice. Date in Country, time of arrival, date and time of departure confirmations of flight/hotel bookings do not count as taxable documents"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Online copies of invoices and receipts are sufficient, a hard copy is not required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal France",
        "additional_info_required": true,
        "additional_info_rule": "Employee's line manager approval required before payroll cutoff date"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Itemized expense reports required along with clear receipts"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "For foreign currency expenses, convert amount to local currency and include currency type and exchange rate used"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Detailed mileage log reports justifying business mileage required including dates, purpose of trips, destinations, and kilometers travelled for each business journey"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal France",
        "additional_info_required": true,
        "additional_info_rule": "All details must be included: worker will need to provide details of trip destination (start point-end point) + Copy of the Car certificate (\"carte grise\" stating HP fiscal engine size)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Employees must send their insurance card, driving license, and vehicle registration document"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "GoGlobal France",
        "additional_info_required": true,
        "additional_info_rule": "A1 certificate is required when travelling"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Any invoice with total amount exceeding €450.00 needs to be sent to local employer as hard copy including detailed address of Parakar"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "Parakar",
        "additional_info_required": true,
        "additional_info_rule": "When submitting expense the description of reason for expense should be precise and detailed as possible"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "EoS",
        "additional_info_required": true,
        "additional_info_rule": "Expenses must be submitted through tool called Jenji"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Expenses must be pre-approved by Line Manager before the fact"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal France",
        "additional_info_required": true,
        "additional_info_rule": "Expense reimbursements processed along with month's salary payment if submitted up to 5th of each month"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "For per diem method, no receipts or invoices need to be provided. However, proof of business trip itself is essential. Company policy might still require receipts for internal control"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "EoS, GoGlobal France, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Expenses like parking or toll fees are not included in mileage allowance. These can be claimed separately based on receipts"
      }
    ]
  },
  "Germany": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Clear and readable receipts and invoices must be submitted with expenses"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Documents must be actual tax receipts or invoices; booking confirmations will not suffice"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show total amount"
      },
      {
        "required_data": "Worker or company name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Atlas",
        "mandatory_optional": "Mandatory",
        "rule": "The worker or the company's name can appear on the invoice or supporting documents"
      },
      {
        "required_data": "ICP company details on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training, Utilities, Professional services",
        "icp_name": "Global People",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice must show Global People DE GmbH Taunusanlage 8, 60329 Frankfurt, Germany VAT ID: DE356366640 - The Local Employers name and details should appear on invoices, not the workers"
      },
      {
        "required_data": "ICP company details on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training, Utilities, Professional services",
        "icp_name": "goGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice must show GoGlobal Germany GmbH Prielmayerstrasse 3, 80335 Munich, Germany - The Local Employers name and details should appear on invoices, not the workers"
      },
      {
        "required_data": "ICP company details on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training, Utilities, Professional services",
        "icp_name": "Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice must show Parakar Germany GmbH, Friesenpl. 4, 50672 Koln, Germany - The Local Employers name and details should appear on invoices, not the workers"
      },
      {
        "required_data": "Employee name as guest/traveler",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "Global People, goGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Hotel/flights etc invoices should indicate the name of the worker not the company. Exception where it is not possible to use Local Employers name e.g. on flight tickets or hotel bookings, in which case the worker should put their own name and details"
      },
      {
        "required_data": "ICP company name, address, VAT",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People",
        "mandatory_optional": "Mandatory",
        "rule": "If invoices are over €150, are required to note the employer's name, address and VAT amount"
      },
      {
        "required_data": "Worker name, address, restaurant VAT ID, invoice details",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Restaurant",
        "icp_name": "Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Invoices exceeding gross amount of EUR 450 must contain: The name of the worker and address, The tax or VAT ID of the restaurant, Invoice serial number, The date of the invoice and the date the meal took place, Net amount, applicable tax rate and VAT"
      },
      {
        "required_data": "ICP name in telecommunications invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "Any mobile phone and home internet invoice must include \"Parakar Germany GmbH\" (at least in c/o) to be reimbursed"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training",
        "icp_name": "Atlas",
        "gross_up": false,
        "gross_up_rule": "Office equipment (business use), Training (job-related) are tax exempt providing correct criteria is followed and genuine business use"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "Atlas",
        "gross_up": true,
        "gross_up_rule": "Phone/internet €20/month max tax-exempt, amounts above this limit are taxable"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies",
        "icp_name": "Atlas",
        "gross_up": true,
        "gross_up_rule": "Home office €6/day, max €1,260/year tax-exempt, amounts above limits are taxable"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Entertainment",
        "icp_name": "Atlas",
        "gross_up": true,
        "gross_up_rule": "Wellness benefits max €600/year tax-exempt, amounts above this limit are taxable"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "Global People",
        "gross_up": false,
        "gross_up_rule": "IT equipment that is considered as company property, Office supplies that are relevant and reasonable in amount are tax exempt"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Restaurant, Fuel, Telecommunications",
        "icp_name": "Global People",
        "gross_up": true,
        "gross_up_rule": "Meals (outside of business travel report), Fuel, Phone Bill, Transportation to workplace, Office groceries, Other items which are not essential to carry out work activity are not tax exempt and employees should be compensated"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Entertainment",
        "icp_name": "Global People",
        "gross_up": true,
        "gross_up_rule": "Entertainment expenses qualify only if offered to third party as well. Entertainment expenses solely for employees of same company will not be accepted"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "goGlobal, Parakar",
        "gross_up": true,
        "gross_up_rule": "Telephone costs can only be reimbursed tax-free at flat rate of up to 20% of invoiced amount, up to maximum of EUR 20 per month"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "goGlobal, Parakar",
        "gross_up": true,
        "gross_up_rule": "Mobile phone usage can only be reimbursed tax-free if worker uses separate phone for personal use and can provide proof of this phone"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "goGlobal",
        "gross_up": true,
        "gross_up_rule": "Internet costs can be reimbursed at flat of 25% of invoice amount tax free"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications",
        "icp_name": "Parakar",
        "gross_up": true,
        "gross_up_rule": "Reimbursement of average expenses on business behalf: Based on three month record an average percentage rate is determined on how much private cell phone is used for business purposes"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Atlas",
        "gross_up": false,
        "gross_up_rule": "Reimbursement rate €0.30 per km (standard tax-free rate for business trips with private vehicle)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People",
        "gross_up": true,
        "gross_up_rule": "KM reimbursement will be tax exempt but fuel will be taxed"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "gross_up": true,
        "gross_up_rule": "Domestic: €28 for full day (24h), €14 for arrival/departure days. International: per diem rates vary per country according to government rates. Any per diem rate offered above government set rate will be fully taxable"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People, goGlobal, Parakar",
        "gross_up": true,
        "gross_up_rule": "Per diems are only tax-free for up to three months of continuous business travel in given location (3-month rule or 3-Monatsfrist). Long stay of more than three months are taxable"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People",
        "gross_up": true,
        "gross_up_rule": "All approved expenses will be paid as NET to the employee and grossed up if they are not tax free"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Atlas, goGlobal, Parakar",
        "gross_up": true,
        "gross_up_rule": "Business expenses related to workers completing their job will usually be tax exempt. Other expenses are subject to varying tax rules. Only purely business related elements of this expense will be tax free, anything additional will be subject to tax"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Online copies are sufficient, a hard copy is not required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Familiarize your worker on how to report their expenses through Expensify or a manual expense report (to be agreed between the worker and manager)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Atlas",
        "additional_info_required": true,
        "additional_info_rule": "Mileage reimbursement requires providing a Fahrtenbuch (mileage logbook), which must include date, route, purpose, and odometer readings (a Mileage log sample is available on request)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Worker will need to share a map with the relevant route (google maps is sufficient) and complete Global People's travel report where applicable"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Per diem method cannot be mixed up with actual expenses. You will need to agree with the worker on one method per business trip"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Atlas, Global People",
        "additional_info_required": true,
        "additional_info_rule": "If meals have been pre-arranged the meal allowance should be reduced by 20 to 40% depending on which meals were provided"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "If breakfast is included e.g. in the hotel fee, 20% of the flat rate will be deducted for the day. If lunch or dinner is provided by the employer, 40% of the fee will be removed"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "goGlobal, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "For Domestic business trips, the total allowance per day is reduced to zero when all meals (breakfast, lunch and dinner) are provided"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "No receipts or invoices need to be provided when using the per diem method. Receipts are not required for per diem when expensing a fixed daily allowance"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Business travel expenses must be submitted using this report: Travel Expense Report.xlsx. All travel related expenses must be reported using this template"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Business Trip - submit a separate report for each trip"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Training",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Training expenses require the approval of the direct manager"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Entertainment",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "For entertainment expense to qualify, entertainment has to have been offered to third party as well. Invoices are required to note Global People's name, address and VAT amount"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Supporting documents required to ensure the flight reimbursement is processed as net: missing payment receipt/invoice as well as ticket copy"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Taxi",
        "icp_name": "goGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Go Global- An A1 certificate is required when travelling"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Receipts should be submitted with the same currency and clear exchange rate"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Original invoices, although stored digitally, need to be kept for 10 years"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Parakar",
        "additional_info_required": true,
        "additional_info_rule": "When submitting an expense the description of the reason for the expense, should be as precise and detailed as possible"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Parakar only accepts expenses that are properly documented by means of invoices or receipts from the provider, that specify the service provided"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "It is crucial that Global People will get a detailed context so they can identify tax free expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "One consolidated report per employee. Expanse details- type of expanse, context, copy of the invoice. Business trip report- each trip needs to be reported on separate report"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Any expenses that needs to be paid as a benefit-gross amount- must be reported as a one time allowance and not as an expanse"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Atlas, Global People, goGlobal, Parakar",
        "additional_info_required": true,
        "additional_info_rule": "Without these documents any applicable tax exemption cannot be applied"
      }
    ]
  },
  "Indonesia": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show vendor name or merchant name that provided goods/services"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show purchase date when transaction occurred"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show amount and currency - total amount must match submitted expense amount"
      },
      {
        "required_data": "Item description for reimbursement",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show details of the item for which reimbursement is being claimed"
      },
      {
        "required_data": "VAT amount clearly listed",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi",
        "icp_name": "EoS, GoGlobal",
        "mandatory_optional": "Optional",
        "rule": "VAT amount should be listed clearly on the invoice if applicable"
      },
      {
        "required_data": "ICP company name on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Professional services",
        "icp_name": "EoS",
        "mandatory_optional": "Mandatory",
        "rule": "On expenses over IDR 5 million the supporting documents must be in the company's name with a proper tax invoice"
      },
      {
        "required_data": "Employee name",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "EoS, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Workers name and details should generally be used on invoices where required"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Flight",
        "icp_name": "EoS, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Reimbursement of airfare ticket for personal trip (expatriate employee round trip ticket to home country) is taxable BIK - subject to gross-up. Business trip airfare is non-taxable"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "EoS, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Personal meals during business trip are taxable BIK - subject to gross-up. Business lunch/entertainment with client/prospect client/vendor is non-taxable"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Telecommunications",
        "icp_name": "EoS, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Mobile phone bills/credit and internet billing are taxable BIK - subject to gross-up"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "EoS, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Reimbursement of fuel and toll from car rental or on private car used is taxable BIK - subject to gross-up. Mileage reimbursement rates are at employer discretion"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies",
        "icp_name": "EoS, GoGlobal",
        "gross_up": false,
        "gross_up_rule": "Reimbursement of purchasing office supplies is non-taxable - no gross-up required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Training",
        "icp_name": "EoS, GoGlobal",
        "gross_up": false,
        "gross_up_rule": "Reimbursement of trainings is non-taxable - no gross-up required"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Taxi",
        "icp_name": "EoS, GoGlobal",
        "gross_up": false,
        "gross_up_rule": "Reimbursement of taxi for visiting client office, government/tax office for business purpose is non-taxable - no gross-up required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Professional services",
        "icp_name": "EoS, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Business expenses related to workers completing their job might be tax exempt - other expenses are subject to varying tax rules including PPh 21 Tax Rate. Only purely business related elements will be tax free, anything additional will be subject to tax"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "EoS, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Car rental dedicated for employee and the car is parked at the employee's home (not parked in the office) is taxable BIK. Reimbursement of car rental used during business trip is non-taxable"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Medical",
        "icp_name": "EoS, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Reimbursement of medical claims personal and medical insurance premium (additional insurance provided to employee and family on top of mandatory benefit) are taxable BIK"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Utilities",
        "icp_name": "EoS, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "House rental provided to employee is taxable BIK"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS",
        "gross_up": true,
        "gross_up_rule": "Any expense or travel allowance submitted without a receipt or invoice will be taxable"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Expenses that fall under taxable income will be treated as per the local regulations"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Business purpose must be established clearly - any expense where business purpose cannot be established will be rejected or postponed"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "EoS, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "For mileage reimbursements, include To and Fro locations, distance travelled and per diem rates"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Convert amount in local currency and include currency & exchange rate used for foreign currency expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Restaurant",
        "icp_name": "EoS, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Name of clients/vendor in the expense report for business meal with clients/vendor must be provided"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "Papaya Partner EoS",
        "additional_info_required": true,
        "additional_info_rule": "Workers set up under Papaya's Partner EoS must submit expenses via their expenses template before the 15th of each month along with the VAT invoices"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before submission"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS",
        "additional_info_required": true,
        "additional_info_rule": "Receipts and invoices must be submitted with expenses - online copies are sufficient, hard copy is not required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "Papaya Partner EoS",
        "additional_info_required": true,
        "additional_info_rule": "When working with Papaya's Partner EoS the hard copy original invoices and receipts need to be sent to the company's office address as required for tax and audit process"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Expense submissions must have an itemized report along with clear receipts - properly labeled receipts for identification"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Taxi, Professional services",
        "icp_name": "EoS",
        "additional_info_required": true,
        "additional_info_rule": "Tax exemptions will only be applied providing sufficient proof is shared e.g. tax receipts, invoices etc"
      }
    ]
  },
  "Italy": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "mandatory_optional": "Mandatory",
        "rule": "Clear and readable receipts and invoices must be submitted with expenses"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "mandatory_optional": "Mandatory",
        "rule": "Documents must be actual tax receipts or invoices preferably scanned not photos"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show total amount"
      },
      {
        "required_data": "ICP company details on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training, Utilities, Professional services",
        "icp_name": "Global People s.r.l.",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice must show Global People s.r.l., Via Venti Settembre 3, Torino (TO) CAP 10121, Italy VAT: IT12455930011 C.F: 12455930011 - The Local Employers name and details should appear on invoices, not the workers"
      },
      {
        "required_data": "ICP company details on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training, Utilities, Professional services",
        "icp_name": "GoGlobal Consulting S.r.l",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice must show GoGlobal Consulting S.r.l Via Uberto Visconti Di Modrone 38 20122 Milano, Italia P.IVA 12205930964 - The Local Employers name and details should appear on invoices, not the workers"
      },
      {
        "required_data": "Employee name as guest/traveler",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "mandatory_optional": "Mandatory",
        "rule": "Exception where it is not possible to use the Local Experts name e.g. on flight tickets/hotels, in which case the workers name and details should be used the end client shouldn't not be mention"
      },
      {
        "required_data": "Payment method",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Taxi",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "mandatory_optional": "Mandatory",
        "rule": "Under Article 10 of Budget Law 2025, obligation to use traceable payment methods: Bank transfers, Postal transfers, Credit cards, Debit cards, Prepaid cards, Bank or cashier's checks"
      },
      {
        "required_data": "Car details",
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "mandatory_optional": "Mandatory",
        "rule": "Car details (the type of car, whether petrol/electric/hybrid, model) must be listed in the expense report"
      },
      {
        "required_data": "Route and kilometers information",
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "mandatory_optional": "Mandatory",
        "rule": "Information regarding the route and the kilometers traveled, which must be reported with indication of the starting point and arrival point"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Utilities, Professional services",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "gross_up": false,
        "gross_up_rule": "Business expenses related to workers completing their job will usually be tax exempt"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Training",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "gross_up": true,
        "gross_up_rule": "All expense that has been approved by the client as a business expense will be NET to the employee (grossed up if not tax free)"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Entertainment",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "gross_up": true,
        "gross_up_rule": "Meals offered to a client/supplier is labeled as \"spese di rappresentanza\" (entertainment expenses) and is tax free up to 75% of the whole amount - remaining 25% is taxable"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "gross_up": true,
        "gross_up_rule": "Maximum limit for mileage claim to be non-taxable is 15,000 Kilometers. Any excess kilometers will be subject to tax"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Fuel, Parking, Taxi",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "gross_up": true,
        "gross_up_rule": "Expenses linked to vehicles i.e. fuel, parking, toll charges, are tax exempt up to 20% of their costs as long as the car is not assigned to a specific employee. Fuel expenses are taxed. Transportation expenses are 100% tax exempt if worker provides evidence of transportation documents (not applicable for company cars)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "gross_up": true,
        "gross_up_rule": "Car Rental up to 15 days is tax exempt. Car Rental longer than 15 days will be subjected to taxes"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "gross_up": true,
        "gross_up_rule": "Domestic: €46.48 per day tax-free (no hotel/meal provision), €30.99 per day (meals or hotels provided), €15.49 per day (both provided). Trips within municipal area: 75% tax exemption on per diem rate. International: €77.46 per day (no provision), €51.65 per day (meals or hotels provided), €25.82 per day (both provided). Long term trips over a month: allowance reduced by 10%"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People s.r.l., GoGlobal",
        "gross_up": true,
        "gross_up_rule": "All approved expenses will be paid as NET to the employee and grossed up if they are not tax-free"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Online copies are sufficient scanned not photo, a hard copy is not required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before it is submitted"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Taxi",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Business Trip - submit a separate report for each trip"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "You cannot mix per diem method with actual expenses. You will need to agree with the worker on one method per business trip"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Scan of the card passport (libretto di circolazione), as it will contain all information regarding the car owner must be provided"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Any screenshot from any app that can track start point, arrival point and KM will work (like google maps) to keep track of the travelled KM"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Full details of the vehicle and proof of distance travelled should be provided as well (e.g. google maps)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Domestic business trips are applicable for travel 60 kilometers or more outside the municipal area of the worker"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "International business travel: Workers must always provide receipts when per diems are in place"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Per diem amounts may vary according to NCBA. For Commercio NCBA for example, in case of business trip with no overnight stay, per diem will be reduced by 1/3"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Entertainment",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "For entertainment expenses (spese di rappresentanza) the worker will always need to mention the 3rd party detail"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Training",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Employee engagement activity and Training and development are additional excepted expense items"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Mileage, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global People s.r.l., GoGlobal Consulting S.r.l",
        "additional_info_required": true,
        "additional_info_rule": "Receipts should be submitted with the same currency and clear exchange rate"
      }
    ]
  },
  "Japan": {
    "receiptStandards": [
      {
        "required_data": "Date of the expense",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the date when the expense occurred"
      },
      {
        "required_data": "Expense type/Description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must clearly describe the type of expense or service purchased"
      },
      {
        "required_data": "Total amount of the expense",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the complete amount paid including all taxes and fees"
      },
      {
        "required_data": "Name of the vendor/merchant",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must display the business name of the supplier who provided goods or services"
      },
      {
        "required_data": "T-Number (Tax Number)",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the tax registration number of the supplier"
      },
      {
        "required_data": "Receipt issued in the name of the employer",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Optional",
        "rule": "Receipt should be issued in the name of the employer (the local entity of GoGlobal that employs the worker) wherever possible"
      },
      {
        "required_data": "Details of number and names of participants on report",
        "travel_non_travel_both": "Both",
        "expense_type": "Restaurant",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "For meal expenses, must add details of number and names of participants on the expense report"
      },
      {
        "required_data": "Exchange rate of main banks on the day of purchase",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "For overseas expenses, exchange rate of main banks on the day of purchase. If paid with cash in local currency, follow the rate printed on currency exchange transaction receipt. If paid with credit card, follow the rate printed on card statement"
      },
      {
        "required_data": "Receipt must be attached, not invoice",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Transportation",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "For domestic travel and accommodation, receipt must be attached, not invoice"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Expenses that fall under taxable income will be treated as per the local regulations"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Include details (date of expense, business purpose, and merchant name) in the expense submission"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "For mileage reimbursements, include To and Fro locations, distance travelled and per diem rates"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Convert amount in local currency and include currency & exchange rate used for foreign currency expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses when using Client's system or GoGlobal template",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Original receipts must be pasted/stapled onto A4-sized sheets and mailed to GoGlobal K.K. 19F 4-1-28 Toranomon Minato-ku, Tokyo 105-0001. All hard copies must be received by 8th or the previous business day if 8th is a holiday for processing in the same month"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "E-receipts should be uploaded as PDF files. Avoid printing/scanning them"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Expense submission must have an itemized report along with clear receipts"
      }
    ]
  },
  "Poland": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show the name of the vendor/merchant that provided the goods or services"
      },
      {
        "required_data": "Transaction on date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the date when the purchase/transaction occurred"
      },
      {
        "required_data": "Total amount",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must display the final cost including all taxes and fees"
      },
      {
        "required_data": "Item description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must specify the goods or services purchased with clear description"
      },
      {
        "required_data": "Employee name on receipt",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "EoS",
        "mandatory_optional": "Mandatory",
        "rule": "The worker's name should generally be used on invoices and supporting documents"
      },
      {
        "required_data": "GoGlobal company name on receipt",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "GOGLOBAL GEO POLAND Sp. z o.o. Kamila Macierzyńska ul. Towarowa 28 00-839 Warszawa"
      },
      {
        "required_data": "Employee or company name on receipt",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "People 2.0",
        "mandatory_optional": "Optional",
        "rule": "The worker's name or local employers name can be used on supporting documents e.g. invoices"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Equipment",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "gross_up": true,
        "gross_up_rule": "Many business expenses related to workers completing their job will be tax exempt. Only purely business related elements of this expense will be tax free, anything additional will be subject to tax"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "gross_up": true,
        "gross_up_rule": "Passenger cars PLN 0.89 per kilometer with an engine capacity of up to 900 cm3 or PLN 1.15 per kilometer with an engine capacity above 900 cm3. For tax-deductible purposes: PLN 0.5214 per kilometre for engine capacity up to 900 cm3 or PLN 0.8358 per kilometre for engine capacity exceeding 900 cm3. Expenses over the limit constitute revenue for the employee"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Restaurant",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "gross_up": true,
        "gross_up_rule": "Domestic travel: The current rate is 45 PLN per day. Duration of Trip up to 8 hours = 0%, between 8 – 12 hours 50%, More than 12 hours 100%. It is possible to increase the daily per diem rate. However, any portion of the per diem amount that exceeds the set Government rate will be taxable"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Restaurant",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "gross_up": true,
        "gross_up_rule": "Domestic travel: When meals are provided free of charge to the employee the meal allowance is reduced by Breakfast 25%, Lunch 50%, Dinner 25%"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Restaurant",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "gross_up": true,
        "gross_up_rule": "International travel: Duration up to 8 hours = 1/3 of allowance, between 8 and 12 hours: 50%, more than 12 hours = 100%. When meals are provided free of charge the meal allowance is reduced by: Breakfast – 15%, lunch – 30% and dinner 30%. Any portion that exceeds the set Government rate will be taxable"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "gross_up": true,
        "gross_up_rule": "Domestic accommodation: amount for an overnight stay cannot exceed 20 times the amount of the allowance (PLN 900). If accommodation not provided and no bill submitted, entitled to lump-sum payment of 150% of the allowance"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "gross_up": true,
        "gross_up_rule": "International accommodation: reimbursement up to limits set in regulations for each country. If no bill provided, entitled to lump-sum payment of 25% of the limit. Higher costs may be reimbursed in justified cases, but surplus over limit constitutes revenue for employee"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "Receipts and invoices must be submitted with expenses. Online copies are sufficient. Documents must be actual tax receipts or invoices; booking confirmations will not suffice"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Only invoices that are hard copies are needed to be sent to GoGlobal in Warsaw. Invoices made electronically are accepted and there is no need to provide hard copies"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before it is submitted"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "For mileage, a log book will need to be submitted. Must include: start/end (date and time), reason from travel, location and approval. This has to be documented in the vehicle mileage log kept by the employee"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Restaurant",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "For Per diems, a log book will need to be submitted. Must include: start/end (date and time), reason from travel, location and approval"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Expenses need to be submitted within 4 months"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "For general reimbursement as per receipts no specific form is required"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "Any costs outside of the per diem should be submitted as expenses against receipts and invoices"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "Per diem is not mandatory to use, and you can choose to give based on actual receipts to the worker. Any travel policy should be agreed upon prior to the worker starting"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "No receipts or invoices need to be provided when using the per diem method"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "Expenses that fall outside of per diem can be reimbursed as expense reimbursements against receipts however will be taxed"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "For international travel, employee must receive advance payment before departure. After return, employee must settle travel within 14 days with supporting documents"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "EoS, GoGlobal, People 2.0",
        "additional_info_required": true,
        "additional_info_rule": "If a document (bill, invoice, ticket) could not be submitted, the employee must submit a written declaration stating the expense incurred and the reasons why it was not documented"
      }
    ]
  },
  "South Korea": {
    "receiptStandards": [
      {
        "required_data": "Transaction on date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Date of the expense must be clearly visible on the receipt"
      },
      {
        "required_data": "Expense type description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Expense type or description of goods/services purchased must be shown on the receipt"
      },
      {
        "required_data": "Total amount",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Total amount of the expense must be clearly displayed on the receipt"
      },
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Name of the vendor or merchant must be visible on the receipt"
      },
      {
        "required_data": "VAT amount",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Optional",
        "rule": "VAT amount must be listed clearly on the invoice if applicable"
      },
      {
        "required_data": "GoGlobal company name on invoice",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Optional",
        "rule": "Invoice in the name of the employer wherever possible. Name of local entity of GoGlobal that employs the worker"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office_supplies, Equipment, Training, Telecommunications",
        "icp_name": "GoGlobal",
        "gross_up": false,
        "gross_up_rule": "Business expenses related to workers completing their job will usually be tax exempt. Only purely business related elements of an expense will be tax free"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "GoGlobal",
        "gross_up": true,
        "gross_up_rule": "There are no set government per diem rates but employer can set their own to be used to cover meals, which will be treated as non-taxable income up to 200,000 KRW per month"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Mileage reimbursement rates between 50 to 80 cents per mile is common. If employee uses own vehicle and submits receipts only, entire amount is non-taxable. If employee claims both receipts and mileage reimbursement, the mileage reimbursement is fully subject to taxation as an allowance"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Other",
        "icp_name": "GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Per diem will be taxable. Any other set daily allowance which is not paid against receipts will be taxable"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Business purpose must be established and clearly documented for all expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Expenses must be submitted with clear and legible copies of receipts, properly labeled for identification"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Itemized expense reports required along with clear receipts"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Client line manager approval required before payroll cutoff date"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "For foreign currency expenses, convert amount to local currency and include currency type and exchange rate used"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "For mileage reimbursements, include To and From locations, distance travelled and per diem rates"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Receipts and invoices must be submitted with expenses. Online copies are sufficient, hard copy not required but workers should keep these filed"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Workers details can be used on the invoice or the Local Employer's details. Addresses do not need to be provided"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office_supplies, Equipment, Training, Telecommunications, Mileage, Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before submission"
      }
    ]
  },
  "Spain": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show the name of the vendor/merchant that provided the goods or services"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the date when the purchase/transaction occurred"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must display the final cost including all taxes and fees"
      },
      {
        "required_data": "Invoice number",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Document must contain a unique invoice or receipt number for identification"
      },
      {
        "required_data": "Item description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must specify the goods or services purchased with clear description (expense type/description)"
      },
      {
        "required_data": "VAT amount listed clearly",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Optional",
        "rule": "VAT amount should be clearly shown on the invoice if applicable"
      },
      {
        "required_data": "Employee name on invoice",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "Baldock, Parakar",
        "mandatory_optional": "Mandatory",
        "rule": "When working with Baldock or Parakar, the worker's name and details should appear on invoices, not the Local Employer"
      },
      {
        "required_data": "Global People company details",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "Global People",
        "mandatory_optional": "Mandatory",
        "rule": "Invoices should show Global PPL Spain, S.L.U., Calle María de Molina, 39, 8A, 280006, Madrid"
      },
      {
        "required_data": "Employee name on travel invoices",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight",
        "icp_name": "Global People",
        "mandatory_optional": "Optional",
        "rule": "For business trips reports, if not possible to show Global People's name and address, then the employee's data should be used"
      },
      {
        "required_data": "GoGlobal entity name on invoices over €100",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "ALL invoices and receipts over 100 euros must have GoGlobal tax number (Cif) and details"
      },
      {
        "required_data": "GoGlobal entity name on invoices under €250",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Optional",
        "rule": "Invoices under EUR 250 can be in either the name of the worker or GoGlobal"
      },
      {
        "required_data": "GoGlobal CIF tax number",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "NIF/CIF & registered office of GoGlobal must appear on invoices over €100 - either B10690717 for GoGlobal IT Consulting Sociedad Limitada or B10690709 for GoGlobal Business Operations Sociedad Limitada"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "Baldock, Global People",
        "gross_up": true,
        "gross_up_rule": "Domestic business travel per diem: €53.34 per day with overnight stay, €26.67 per day without overnight stay. International business travel per diem: €91.35 per day with overnight stay, €48.08 per day without overnight stay. Any amount spent above the per diem will be taxable"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "Parakar",
        "gross_up": true,
        "gross_up_rule": "All expenses will be processed via receipts and invoices instead of per diem method. Tax treatment applies based on actual expenses incurred"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Per diems will not be used, instead all expenses will be processed via receipts and invoices. All expenses are subject to taxation review based on actual amounts"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "The current (2024) mileage rate is €0.26 per kilometer tax-free. Employers may choose to reimburse more than the above, but the higher rate per kilometer is considered taxable income for the employee and must be reported accordingly"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "gross_up": false,
        "gross_up_rule": "Many business expenses related to workers completing their job will be tax exempt, providing sufficient proof is shared such as tax receipts, invoices"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Restaurant",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "For travel and stay for a continuous period of more than nine months, allowances will not be exempt from taxation"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Transportation",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "When employee uses public transport, the amount of the expense must be justified by an invoice or equivalent document. Otherwise, €0.19 per kilometre travelled plus toll and parking costs that are justified"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Excel Log book & Travel expenses template must be submitted with the expense reimbursement request"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "Global People",
        "additional_info_required": true,
        "additional_info_rule": "Excel Log book & Travel expenses template must be submitted with the expense reimbursement request. If a different template is used it should include details of Start and End Date, Start and Destination Point, Purpose of the Trip and list all expenses"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Employee must report date, starting point, end point, number of km and detail the business purpose. Screenshot/printout of the travel route using GoogleMaps or similar site required. Report must be signed both by employee and employer. Electronic signature is allowed"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "For trips carried out in one month and exceeding 200 euros, additional business justification required. Complete the template letter, obtain the client's signature, and provide a copy"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Receipts and invoices must be submitted with expenses. Online copies are sufficient, hard copy not required. Documents must be actual tax receipts or invoices; booking confirmations will not suffice"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before submission"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "Baldock, Global People, Parakar, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "For the purposes of travel allowances, the payer must prove the date and place of the trip, as well as the reason or motive"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Convert amount in local currency and include currency & exchange rate used for foreign currency expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Include details (date of expense, business purpose, and merchant name) with all submissions"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Expenses must be submitted within 6 months after the date that the expense was incurred"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Client line manager must review and approve expenses before payroll cutoff date"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Expenses submitted without itemised reports or properly labeled receipts will be rejected or delayed"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Taxi, Training, Mileage",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Keep hard copies of receipts for a minimum of 4 years to ensure compliance with local tax regulations"
      }
    ]
  },
  "Switzerland": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global PPL CH GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Receipts and invoices must be submitted alongside expense items"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global PPL CH GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Documents must be actual tax receipts or invoices; booking confirmations will not be sufficient"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global PPL CH GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Document must show total amount"
      },
      {
        "required_data": "ICP company details on invoice",
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training, Utilities, Professional services",
        "icp_name": "Global PPL CH GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Invoice must show Global PPL CH GmbH, Freigutstrasse 2 8002 Zürich, Switzerland CHE-295.369.918 - The Local Employer's name and details should appear on invoices"
      },
      {
        "required_data": "ICP company details on invoice",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "Global PPL CH GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "The Local Employer's name and details should appear on invoices, except where this won't be possible e.g. flight bookings"
      },
      {
        "required_data": "Employee name as guest/traveler",
        "travel_non_travel_both": "Travel",
        "expense_type": "Flight",
        "icp_name": "Global PPL CH GmbH",
        "mandatory_optional": "Mandatory",
        "rule": "Exception when it is not possible to use the Local Employers name, e.g. on flight bookings. The workers name should then be used instead"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Utilities, Professional services",
        "icp_name": "Global PPL CH GmbH",
        "gross_up": false,
        "gross_up_rule": "Business expenses related to workers completing their job are usually tax exempt. Expenses which are business related e.g. laptops, office supplies, etc. will be tax free providing sufficient proof is included"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Training",
        "icp_name": "Global PPL CH GmbH",
        "gross_up": true,
        "gross_up_rule": "Other expenses are subject to varying tax rules. All approved expenses will be paid as NET to the employee and grossed up if they are not tax free"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "Global PPL CH GmbH",
        "gross_up": true,
        "gross_up_rule": "Smaller business expenses tax-free can be reimbursed against receipts (e.g. expenses that occur during a business trip) of a maximum of CHF 20 - amounts above this limit may be subject to tax"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global PPL CH GmbH",
        "gross_up": false,
        "gross_up_rule": "Mileage reimbursed according to official rates set by government - tax-free when following official mileage rates"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global PPL CH GmbH",
        "gross_up": true,
        "gross_up_rule": "Domestic and International: Breakfast CHF 15.00, Lunch CHF 35.00, Dinner CHF 40.00 tax-free. Any portion of per diem amount that exceeds the set rate will be taxable and must have a receipt provided"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Taxi",
        "icp_name": "Global PPL CH GmbH",
        "gross_up": true,
        "gross_up_rule": "Overnight expenses such as hotels and transport should be reimbursed as expenses against receipts and invoices - all approved expenses will be paid as NET to employee and grossed up if not tax free"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Entertainment, Medical",
        "icp_name": "Global PPL CH GmbH",
        "gross_up": true,
        "gross_up_rule": "Other expenses are subject to varying tax rules. All approved expenses will be paid as NET to the employee and grossed up if they are not tax free"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Training",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Training expenses require the approval of the direct manager"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "A logbook is required for each used car"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Worker will need to share a map with the relevant route (google maps is sufficient)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Our local partner reimbursed mileage per calculation method based on route, car details and destination"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "If a worker uses more than one vehicle in a year the mileage will all be calculated based on a combined mileage total"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Taxi",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Workers should submit a separate report per each business trip"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Workers should keep all their expenses in a simple report of their choice"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before it is submitted"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "The receipts/invoices should be reported in the local currency the worker will need to add the FX rate they have used to calculate the expense"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Online copies of invoices and receipts are sufficient, a hard copy is not required"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Employers can choose not to use per diems and instead reimburse meals against receipts - need to choose one method"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Restaurant",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Per diem can be paid upon the workers return, it does not need to be paid in advance"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Entertainment, Utilities, Professional services, Medical",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Without the correct supporting documents any applicable tax exemption cannot be applied"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Training, Utilities, Professional services",
        "icp_name": "Global PPL CH GmbH",
        "additional_info_required": true,
        "additional_info_rule": "Only purely business related elements of this expense will be tax free, anything additional will be subject to tax"
      }
    ]
  },
  "Taiwan": {
    "receiptStandards": [
      {
        "required_data": "Date of the expense",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Equipment, Telecommunications, Shipping, Training, Insurance, Mileage",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the date when the expense was incurred"
      },
      {
        "required_data": "Expense type/Description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Equipment, Telecommunications, Shipping, Training, Insurance, Mileage",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must specify the type of expense or detailed description of goods/services purchased"
      },
      {
        "required_data": "Total amount of the expense",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Equipment, Telecommunications, Shipping, Training, Insurance, Mileage",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must display the total cost of the expense"
      },
      {
        "required_data": "Name of the vendor/merchant",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Equipment, Telecommunications, Shipping, Training, Insurance, Mileage",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the business name of the supplier providing the goods or services"
      },
      {
        "required_data": "Tax amount listed clearly",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Equipment, Telecommunications, Shipping, Training, Insurance, Mileage",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "mandatory_optional": "Optional",
        "rule": "Tax amount, listed clearly on the Invoice (if applicable)"
      },
      {
        "required_data": "Local Employer name on supporting documents",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Equipment, Telecommunications, Shipping, Training, Insurance, Mileage",
        "icp_name": "Papaya, Local Employer",
        "mandatory_optional": "Optional",
        "rule": "The Local Employer's name and details should be used on supporting documents where possible"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": false,
        "gross_up_rule": "Business expenses related to workers completing their job will usually be tax-exempt. Only purely business-related elements of an expense will be tax-free"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Restaurant (meal allowance)",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": true,
        "gross_up_rule": "The upper tax exempted limit of monthly meal allowance per person (including Overtime meals) is NT 3,000. Amounts above this limit will be subject to tax"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": false,
        "gross_up_rule": "Domestic and international business travel expenses follow the same process as reimbursement of non-travel expenses. There are no set government per diem rates and employers can reimburse against receipts and invoices. If reimbursed against receipts and invoices then these will be tax exempt"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": true,
        "gross_up_rule": "Mileage reimbursement rates and rules for workers who use their private vehicles for work purposes are not stipulated in the Labour Code. Reimbursement of mileage, fuel, parking, and car expenses is done at the discretion of each employer"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Non-business elements",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": true,
        "gross_up_rule": "Only purely business-related elements of an expense will be tax-free, anything additional will be subject to tax"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Expenses without proper documentation",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": true,
        "gross_up_rule": "Without these documents, any applicable tax exemption cannot be applied. Tax exemptions will only be applied providing sufficient proof is shared e.g. tax receipts, invoices, etc"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Personal and family expenses",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": true,
        "gross_up_rule": "Expenses for spouses, partners, and other family members. Personal expenses (any non-business-related expenses). Any casual emolument or benefit attached to an office or position in addition to salary or wages (e.g., salary of house help, gas, water, or electricity bills, school fees, personal travel)"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Expenses falling under taxable income",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": true,
        "gross_up_rule": "Expenses that fall under taxable income will be treated as per the local regulations"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Supplemental Benefit - Personal Insurance",
        "icp_name": "GoGlobal, Papaya, Local Employer",
        "gross_up": true,
        "gross_up_rule": "Supplemental Benefit – Personal Insurance listed as accepted expense but expenses that fall under taxable income will be treated as per the local regulations"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Establish clear business purpose of all incurred expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Submit expense claims with clear and legible copies of receipts to Client line manager for approval preferably within the same month of the expense"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Client line manager review and approval required - ensure expenses have all correct and needed information and clear business purpose"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Share with GoGlobal the approved expenses per worker before the payroll cut off date to process them in the same month"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Expense submission must have itemized report along with clear receipts"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Receipts must be properly labeled for identification"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Correct categorization of the incurred expense required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Clear and legible receipts, with total amount matching the receipts, labeled properly for identification required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "GoGlobal validates receipts according to local regulations and follows up on missing or questionable receipts, postpones or rejects reimbursements if required for compliance and taxability"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Documents must be actual tax receipts or invoices; booking confirmations will not suffice"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Online copies are sufficient, hard copy is not required to be shared but workers should keep these filed"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Online copies can be submitted for the expense payment but employees will need to submit hard copy receipts to the Taiwan local rep for company tax purposes"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before submission"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Include details (date of expense, business purpose, and merchant name)"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Expenses are processed in the monthly payroll and will be paid together with the monthly salary"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Review submitted expense reports and approve expense claims, ensuring all required supporting documents have been included e.g. receipts, invoices, by the agreed cutoff date"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "Papaya",
        "additional_info_required": true,
        "additional_info_rule": "Papaya will share the submitted report with the Local Employer for processing and reimbursement"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Expense reimbursements will be processed within the monthly payroll run and will be reflected in the worker's pay slip"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "For the specific process of invoice submission visit this page"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Foreign currency expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Convert amount in local currency and include currency & exchange rate used for foreign currency expenses"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "For mileage reimbursements, include To and Fro locations, distance travelled and per diem rates"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "If claimed for reimbursement, workers should submit a mileage claim report which consists of the travel details which include the date, total distance of traveling, departure & arrival city, mileage rate and total mileage claimed, business purpose (name of customers visited)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Domestic and International Travel",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Go Global requires a expense report with the accompanying receipts and invoices"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Familiarize worker on how to report expenses through Expensify or manual expense report (to be agreed between worker and manager)"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Determine internal process and expense policy so that they know the method and deadline for submitting expense claims to their Line Manager and how – via Expensify or Papaya expense report template"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Expenses approved after payroll cutoff date are processed in the following month"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, Papaya, Tiger Consulting",
        "additional_info_required": true,
        "additional_info_rule": "Expenses submitted without itemized reports or properly labeled receipts will be rejected or postponed"
      }
    ]
  },
  "Thailand": {
    "receiptStandards": [
      {
        "required_data": "Date of the expense",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CO.,LTD, RJ Supply and Service Co., Ltd.",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the date when the expense was incurred"
      },
      {
        "required_data": "Expense type/Description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CO.,LTD, RJ Supply and Service Co., Ltd.",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must specify the type of expense or detailed description of goods/services purchased"
      },
      {
        "required_data": "Total amount of the expense",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CO.,LTD, RJ Supply and Service Co., Ltd.",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must display the total cost of the expense"
      },
      {
        "required_data": "Name of the vendor/merchant",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CO.,LTD, RJ Supply and Service Co., Ltd.",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the business name of the supplier providing the goods or services"
      },
      {
        "required_data": "VAT amount listed clearly",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CO.,LTD, RJ Supply and Service Co., Ltd.",
        "mandatory_optional": "Optional",
        "rule": "VAT amount, listed clearly on the Invoice (if applicable)"
      },
      {
        "required_data": "Local Employer name on invoice",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "AYP HR GROUP CO.,LTD",
        "mandatory_optional": "Mandatory",
        "rule": "The Local Employers name and details should appear on supporting documents, not the workers. Invoice in the name of the Employer (wherever possible). For AYP: AYP HR GROUP CO.,LTD (บริษัท เอวายพีเอชอาร์กรุ๊ป จำกัด)"
      },
      {
        "required_data": "Local Employer name on invoice",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "RJ Supply and Service Co., Ltd.",
        "mandatory_optional": "Mandatory",
        "rule": "Name on receipt/invoice should be RJ Supply and Service Co., Ltd."
      },
      {
        "required_data": "Local Employer tax ID",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunica",
        "icp_name": "AYP HR GROUP CO.,LTD",
        "mandatory_optional": "Mandatory",
        "rule": "Company Tax ID: 0105560119091 should appear on supporting documents"
      },
      {
        "required_data": "Local Employer address",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi, Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "AYP HR GROUP CO.,LTD",
        "mandatory_optional": "Mandatory",
        "rule": "Company Address: 1 Empire Tower 47th FL. Unit 4703, South Sathorn Road, Yannawa Sathorn Bangkok 10120 (1 เอ็มไพร์ทาวเวอร์ชั้น 47 ยูนิต 4703 ถนนสาทรใต้แขวงยานนาวา เขตสาทร กรุงเทพมหาคร 10120)"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment, Telecommunications, Shipping, Training",
        "icp_name": "AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "gross_up": false,
        "gross_up_rule": "Business expenses related to workers completing their job will usually be tax exempt. Only purely business related elements of an expense will be tax free"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Train, Restaurant, Taxi",
        "icp_name": "AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "gross_up": false,
        "gross_up_rule": "If expenses are reimbursed as normal against receipts and invoices (with the Local Employers details) then these will be tax exempt for both domestic and international business travel"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Per diem allowance",
        "icp_name": "AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "gross_up": true,
        "gross_up_rule": "There are no set government per diem rates and any fixed lump sum allowance given will be taxable for both domestic and international travel"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage without proper documentation",
        "icp_name": "AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "gross_up": true,
        "gross_up_rule": "Reimbursement of mileage, fuel, parking and car expenses are done at the discretion of each employer. To be tax exempt workers must submit a travelling report approved by their manager"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Non-business elements",
        "icp_name": "AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "gross_up": true,
        "gross_up_rule": "Only purely business related elements of an expense will be tax free, anything additional will be subject to tax"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Expenses without proper documentation",
        "icp_name": "AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "gross_up": true,
        "gross_up_rule": "Tax exemptions will only be applied providing sufficient proof is shared e.g. tax receipts, invoices etc, with the Local Partners details on the supporting documents"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Personal and family expenses",
        "icp_name": "AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "gross_up": true,
        "gross_up_rule": "Expenses for spouses, partners, and other family members. Personal expenses (any non-business-related expenses). Any casual emolument or benefit attached to an office or position in addition to salary or wages (e.g., salary of house help, gas, water, or electricity bills, school fees, personal travel)"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Establish clear business purpose of all incurred expenses"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Submit expense claims with clear and legible copies of receipts to Client line manager for approval preferably within the same month of the expense"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Client line manager review and approval required - ensure expenses have all correct and needed information and clear business purpose"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Share with GoGlobal the approved expenses per worker before the payroll cut off date to process them in the same month"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Expense submission must have itemized report along with clear receipts"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Receipts must be properly labeled for identification"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Correct categorization of the incurred expense required"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before submission"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "GoGlobal validates receipts according to local regulations and follows up on missing or questionable receipts, postpones or rejects reimbursements if required for compliance and taxability"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Foreign currency expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Convert amount in local currency and include currency & exchange rate used for foreign currency expenses"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "For mileage reimbursements, include To and Fro locations, distance travelled and per diem rates"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Mileage",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Travelling report approved by manager required for tax exemption"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Telecommunications with employee name",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Where a particular receipt must state the workers name e.g. internet or mobile bill, the Local Employer will request in writing to the worker that they submit a petty cash form with the original receipts copy for reference"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Familiarize worker on how to report expenses through Expensify or manual expense report (to be agreed between worker and manager)"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Determine internal process and expense policy including method and deadline for submitting expense claims to Line Manager"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Expenses approved after payroll cutoff date are processed in the following month"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Expenses submitted without itemized reports or properly labeled receipts will be rejected or postponed"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal, AYP HR GROUP CO.,LTD, RJ Supply and Service Co., Ltd.",
        "additional_info_required": true,
        "additional_info_rule": "Online copies are sufficient, hard copy is not required"
      }
    ]
  },
  "Vietnam": {
    "receiptStandards": [
      {
        "required_data": "Date of the expense",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the date when the expense occurred"
      },
      {
        "required_data": "Expense type/Description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must clearly describe the type of expense or service purchased"
      },
      {
        "required_data": "Total amount of the expense",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show the complete amount paid including all taxes and fees"
      },
      {
        "required_data": "Name of the vendor/merchant",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, GoGlobal",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must display the business name of the supplier who provided goods or services"
      },
      {
        "required_data": "VAT amount, listed clearly on the invoice",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "GoGlobal",
        "mandatory_optional": "Optional",
        "rule": "VAT amount should be listed clearly on the invoice if applicable"
      },
      {
        "required_data": "Vendor details for expenses below 200,000 VND",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "mandatory_optional": "Mandatory",
        "rule": "Sales invoice must include vendor name, address, date of purchase, stamp of vendor"
      },
      {
        "required_data": "Seller signature for white receipts below 200,000 VND",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "mandatory_optional": "Mandatory",
        "rule": "Where vendor does not have stamp, white receipt must show vendor name, address, date of purchase and signature of seller"
      },
      {
        "required_data": "Local Employer details on VAT/Red invoice above 200,000 VND",
        "travel_non_travel_both": "Both",
        "expense_type": "Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED",
        "mandatory_optional": "Mandatory",
        "rule": "VAT/Red invoice must show: AYP HR GROUP COMPANY LIMITED, TAX CODE: 0314571540, ADDRESS: R.1901, Saigon Trade Center Building, 37 Ton Duc Thang Street, Ben Nghe Ward, District 1, Ho Chi Minh City, Vietnam"
      },
      {
        "required_data": "Local Employer details on VAT/Red invoice above 200,000 VND",
        "travel_non_travel_both": "Both",
        "expense_type": "Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "GOGLOBAL VIETNAM COMPANY LIMITED",
        "mandatory_optional": "Mandatory",
        "rule": "VAT/Red invoice must show: GOGLOBAL VIETNAM COMPANY LIMITED, Tax Code: 0315261446, Address: Tầng 1, tòa nhà Packsimex, 52 Đông Du, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh City"
      },
      {
        "required_data": "Local Employer details on VAT/Red invoice above 200,000 VND",
        "travel_non_travel_both": "Both",
        "expense_type": "Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "mandatory_optional": "Mandatory",
        "rule": "VAT/Red invoice must show: CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, Tax Code: 0105605517, Address: Số 2, Đường Ngô Đức Kế, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, Việt Nam"
      },
      {
        "required_data": "Employee name and EOS company details on receipt over USD 80.00",
        "travel_non_travel_both": "Both",
        "expense_type": "Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "CÔNG TY TNHH DỊCH VỤ SIGMA",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt must show employee's name and CÔNG TY TNHH DỊCH VỤ SIGMA, Tầng 4-9-11, The Galleria Metro 6 Office Tower, 59 Võ Nguyên Giáp, Phường Thảo Điền, Thành phố Thủ Đức, Thành phố Hồ Chí Minh, Mã số thuế/Tax code: 0313137919"
      },
      {
        "required_data": "Departure point, destination, dates of travel",
        "travel_non_travel_both": "Travel",
        "expense_type": "Transportation",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "mandatory_optional": "Mandatory",
        "rule": "Transportation cost invoices must include details of departure point, destination, dates of travel"
      },
      {
        "required_data": "Transport company details",
        "travel_non_travel_both": "Travel",
        "expense_type": "Transportation",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "mandatory_optional": "Mandatory",
        "rule": "Bus tickets must show Transport company details including Name of Bus, Tax code, Address of Headquarter"
      },
      {
        "required_data": "Unit, quantity, unit price per night, total cost",
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "mandatory_optional": "Mandatory",
        "rule": "Hotel invoice must include information regarding unit, quantity, unit price per night, total cost"
      },
      {
        "required_data": "Printed receipt only",
        "travel_non_travel_both": "Both",
        "expense_type": "Transportation",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "mandatory_optional": "Mandatory",
        "rule": "Taxi costs will only be reimbursed against printed receipts, hand-written receipts will not be accepted"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, GoGlobal",
        "gross_up": true,
        "gross_up_rule": "Approved expenses can be paid to worker as NET and grossed up if they are not tax-free. Tax exemptions will only be applied to purely business related elements"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Expenses without eligible invoice/proof",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "gross_up": true,
        "gross_up_rule": "For those cost without eligible invoice/Proof document or rejected for claim, Corporate Income Tax (20%) will be charged as per current regulations"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "AYP HR GROUP COMPANY LIMITED",
        "gross_up": true,
        "gross_up_rule": "Mileage rates must be stipulated in Labor contract in order to be tax exempt"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "CÔNG TY TNHH DỊCH VỤ SIGMA",
        "gross_up": true,
        "gross_up_rule": "Generally the rate is set at VND 1,600 per kilometer for cars"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "AYP HR GROUP COMPANY LIMITED",
        "gross_up": true,
        "gross_up_rule": "Per diem policy must be stipulated in Labor contract in order to be tax exempt"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement, Insurance",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Include details (date of expense, business purpose, and merchant name) in the expense submission"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Equipment, Software, Training, Transportation, Mileage, Shipping, Employee engagement",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING",
        "additional_info_required": true,
        "additional_info_rule": "Convert amount in local currency and include currency & exchange rate used for foreign currency expenses"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "For mileage reimbursements, include To and Fro locations, distance travelled and per diem rates"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expenses",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Expense submission must have an itemized report along with clear receipts"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Restaurant with unclear details",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "additional_info_required": true,
        "additional_info_rule": "Where invoices do not have clear details e.g. written as \"Meal and Drink cost\", the worker must also submit a detailed list of each item as supporting document"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Flight",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "additional_info_required": true,
        "additional_info_rule": "Air Ticket claims must include the Boarding Pass, the flight ticket and a red invoice"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Flight",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Air tickets should be supported with itinerary in the name of employee or the invoice issued by travel agency in the name of employer. If the employee purchases travelling insurance, the quota invoice issued by insurance company is acceptable"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "additional_info_required": true,
        "additional_info_rule": "If hotel invoice cannot show unit, quantity, unit price per night, total cost information, then booking details with red stamp of hotel must also be submitted"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Accommodation fee should be supported with the invoice and the detailed bill"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Transportation",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "additional_info_required": true,
        "additional_info_rule": "Railway tickets in Vietnam have a specific purple pink color and can thus be used to replace the Tax invoice at any rates. When an online booking method is used, the electronic invoice with the Boarding Pass must be submitted. A booking reference or receipt will not be accepted instead of bus ticket"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Transportation",
        "icp_name": "GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Ground transportation fee shall be supported with the taxi invoice. If the employee uses Grab/Bee or other apps to call a car, both invoices and trip details are necessary to be submitted"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Expenses over 20,000,000 VND",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "additional_info_required": true,
        "additional_info_rule": "Worker will need to contact Papaya who will arrange for the Local Employer to reimburse via bank transfer to Vendor. Payment documents must include Service/Sales Contract, Liquidation Agreement signed by Local Employer and stamped. It could take up to 2 weeks to process these payments"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "VAT/Red receipts",
        "icp_name": "AYP HR GROUP COMPANY LIMITED",
        "additional_info_required": true,
        "additional_info_rule": "VAT/Red receipts must be posted to: Hoàng Như Ngọc (0979737268) – 7.03 Newtown apartment, Hiep Binh Chanh ward, Thủ Đức, HCMC"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "VAT/Red receipts",
        "icp_name": "GOGLOBAL VIETNAM COMPANY LIMITED",
        "additional_info_required": true,
        "additional_info_rule": "VAT/Red receipts must be posted to: No 67, Mertia Khang Dien, Lien Phuong Street, Phuong Long B Ward, Thu Duc City – Ho Chi Minh City"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "VAT/Red receipts",
        "icp_name": "CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "additional_info_required": true,
        "additional_info_rule": "VAT/Red receipts must be posted to: Address: Số 2, Đường Ngô Đức Kế, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, Việt Nam"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Receipts equivalent to 20,000,000 VND",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM",
        "additional_info_required": true,
        "additional_info_rule": "Worker should ask the vendor to split the invoice/Receipt and use different dates on them"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "Manager approval process",
        "icp_name": "AYP HR GROUP COMPANY LIMITED, CÔNG TY TNHH DỊCH VỤ SIGMA, GOGLOBAL VIETNAM COMPANY LIMITED, CÔNG TY TNHH TIGER CONSULTING VIỆT NAM, GoGlobal",
        "additional_info_required": true,
        "additional_info_rule": "Review submitted expense reports and approve expense claims, ensuring all required supporting documents have been included by the agreed cutoff date"
      }
    ]
  },
  "Australia": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Professional services, Medical, Telecommunications, Utilities, Mileage, Entertainment",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": ""
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Professional services, Medical, Telecommunications, Utilities, Mileage, Entertainment",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": "Transaction date must appear on receipt or invoice"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Professional services, Medical, Telecommunications",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": "Total amount must be visible on receipt or invoice"
      },
      {
        "required_data": "Consumer name (Employee name as recipient)",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Professional services, Medical, Telecommunications, Utilities, Mileage, Entertainment",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": "The workers name and details should appear on invoices as the recipient/consumer, not the Local Employers details"
      },
      {
        "required_data": "Tax information (Supplier tax registration details)",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Training, Professional services, Medical, Telecommunications, Utilities, Mileage, Entertainment",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": "Receipt or invoice must be actual tax receipt or invoice with supplier tax registration details to qualify for tax exemption processing"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": true,
        "gross_up_rule": "Business expenses related to workers completing their job (laptops, office supplies etc.) are usually tax exempt when purely business-related. Any non-business or personal elements will be subject to tax"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Health insurance, Wellness benefits",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": true,
        "gross_up_rule": "Health insurance and wellness benefits are not tax exempt business expenses and must be processed as Fringe Benefits Tax (FBT) and subject to taxation"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": false,
        "gross_up_rule": "Motor vehicle or car expenses when work-related can be claimed tax-free using either cents per kilometer method or logbook method per ATO guidelines"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Meals, Flight",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": true,
        "gross_up_rule": "Domestic business trips are non-taxable up to the daily per diem limit (covers lodging, meals, and incidentals) based on worker income level. Any expenditure exceeding the per diem rates will be taxed as ordinary income"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Meals, Flight",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": true,
        "gross_up_rule": "International business trips use ATO per diem method with set rates for subsistence costs (lodging, meals, incidentals) tax-free based on worker income and destination country. Any expenditure exceeding per diem rates will be taxed as ordinary income"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": true,
        "gross_up_rule": "If a receipt is not provided, the expense will be fully taxed. Without supporting documents, any applicable tax exemption cannot be applied"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "additional_info_required": true,
        "additional_info_rule": "Manager approval required before expense reimbursement can be processed"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "additional_info_required": true,
        "additional_info_rule": "Workers must submit tax form each year (July to October) to claim any applicable tax deduction. Workers can use ATO myDeductions tool to track and manage expenses throughout the year"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "additional_info_required": true,
        "additional_info_rule": "Workers must submit Mileage Expense Form when using logbook method for reimbursement"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "additional_info_required": true,
        "additional_info_rule": "Distance records must be maintained and submitted within the monthly expense reimbursement report"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Meals, Flight",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "additional_info_required": true,
        "additional_info_rule": "For domestic travel, workers must provide: (1) Travel proof in the form of tickets and hotel reservations, (2) Rough estimate of expenditure if actual receipts not available, (3) Proof of money spent (credit card statement or other banking records)"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Meals, Flight",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "additional_info_required": true,
        "additional_info_rule": "For international travel exceeding 6 days, workers must keep copies of all receipts for the travel (incidental expenses, accommodation, etc.) as ATO might request them during tax return checks"
      }
    ]
  },
  "India": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage, Transportation",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "mandatory_optional": "Mandatory",
        "rule": "Documents must be actual tax receipts or invoices showing supplier business name. Booking confirmations will not suffice"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage, Transportation",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "mandatory_optional": "Mandatory",
        "rule": "Date of the expense must appear on receipts and invoices"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage, Transportation",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "mandatory_optional": "Mandatory",
        "rule": "Amount as mentioned on the receipt must be visible, showing the local currency amount"
      },
      {
        "required_data": "Item description",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage, Transportation",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "mandatory_optional": "Mandatory",
        "rule": "Expense description must be clear on the receipt showing what goods or services were purchased"
      },
      {
        "required_data": "Consumer name (Employee name as recipient)",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage, Transportation",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "mandatory_optional": "Mandatory",
        "rule": "The workers name and details should appear on invoices, not the Local Employer. For Papaya Direct: not American EPAY Services Pvt Ltd (10th Floor, Corporate Park, Tower-A/2, Plot No.-7A/1, Sector-142, Noida-201301)"
      },
      {
        "required_data": "Tax information (Supplier tax registration details)",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Transportation",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "mandatory_optional": "Mandatory",
        "rule": "Documents must be actual tax receipts or invoices with supplier tax registration details to qualify for tax exemption"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "gross_up": true,
        "gross_up_rule": "Business expenses related to workers completing their job will usually be tax exempt. Only purely business related elements of an expense will be tax free, anything additional will be subject to tax. Tax exemptions will only be applied providing sufficient proof is shared"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "gross_up": false,
        "gross_up_rule": "Workers using private vehicles, including cars, vans, motorbikes and bicycles, for work purposes should be reimbursed tax free according to the mileage traveled"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "gross_up": false,
        "gross_up_rule": "Domestic and international business travel expenses using per diem method or reimbursed against receipts are tax free"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "gross_up": true,
        "gross_up_rule": "Without supporting documents any applicable tax exemption cannot be applied. If receipts or invoices are not provided, the expense will be subject to tax"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "additional_info_required": true,
        "additional_info_rule": "Manager must review submitted expense reports and approve expense claims, ensuring all required supporting documents (receipts, invoices) have been included by the agreed cutoff date"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "additional_info_required": true,
        "additional_info_rule": "Any personal information not required for reimbursement purposes should be removed before it is submitted"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "Procloz",
        "additional_info_required": true,
        "additional_info_rule": "Submit expenses using template: India (Procloz) Expense Receipts Summary.xlsx. Template requires: Employee ID, Employee Name, Date of the Expense, Expense Description, Amount (in local currency), FX rate, Amount (in INR), File name of the receipt"
      },
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "American EPAY Services Pvt Ltd",
        "additional_info_required": true,
        "additional_info_rule": "Submit expenses using template: Expense report template INR.xlsx. Template requires: Employee Name, Department, Phone, Employee ID, Starting Date, Ending Date, Travel From, Travel To, Purpose"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "Procloz",
        "additional_info_required": true,
        "additional_info_rule": "Minimum mileage rate: 20 INR per km (each employer can set their own specific rate). Mileage must be recorded and submitted within the monthly expense reimbursement report. Receipts must be provided for audit purposes"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "American EPAY Services Pvt Ltd",
        "additional_info_required": true,
        "additional_info_rule": "Mileage rate: 14 INR per km. Mileage must be recorded and submitted within the monthly expense reimbursement report including: reimbursement rate, total miles, and total mileage reimbursement calculation"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "American EPAY Services Pvt Ltd",
        "additional_info_required": true,
        "additional_info_rule": "For each mileage expense: Date, Vehicle Type (Rental, Work, or Personal), Total KM, Comments must be documented. Map screenshot must be attached per ride showing distance traveled"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "Procloz",
        "additional_info_required": true,
        "additional_info_rule": "Domestic business travel: No set per diem rates. Each employer can set their own allowance and daily limit. The minimum rate that should be used is 2500 INR per day. Receipts must be provided for audit purposes when using this set daily limit. Alternatively, costs can be reimbursed as regular expenses against receipts and supporting documents"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "Procloz",
        "additional_info_required": true,
        "additional_info_rule": "International business travel minimum per diem rates: Europe – 55 EUR per day, UK – 50 GBP per day, Rest of the World – 60 USD per day. Receipts must be provided for audit purposes. Per diem can be paid upon the workers return, it does not need to be paid in advance. Alternatively, workers can provide receipts for reimbursement instead of using the per diem method"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "American EPAY Services Pvt Ltd",
        "additional_info_required": true,
        "additional_info_rule": "International business travel: 25 USD per day. Receipts must be provided for audit purposes. Per diem can be paid upon the workers return, it does not need to be paid in advance"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "Procloz, American EPAY Services Pvt Ltd",
        "additional_info_required": true,
        "additional_info_rule": "For expenses in foreign currency: Document original currency amount, foreign exchange rate (FX rate), and converted amount in INR (payment currency) in the expense report"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant, Transportation",
        "icp_name": "American EPAY Services Pvt Ltd",
        "additional_info_required": true,
        "additional_info_rule": "Travel information must be documented in expense report: Starting Date, Ending Date, Travel From location, Travel To location, and Purpose of trip"
      }
    ]
  },
  "UAE": {
    "receiptStandards": [
      {
        "required_data": "Supplier business name",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": "Receipts and invoices must be submitted with expenses"
      },
      {
        "required_data": "Transaction date",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": "Receipts and invoices must show transaction date"
      },
      {
        "required_data": "Total amount in local currency",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": "Receipts and invoices must show total amount"
      },
      {
        "required_data": "Consumer name (Employee name as recipient)",
        "travel_non_travel_both": "Both",
        "expense_type": "Hotel, Flight, Restaurant, Office supplies, Software, Equipment, Mileage",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "mandatory_optional": "Mandatory",
        "rule": "The workers name and details should appear on invoices, not the Local Employers details"
      }
    ],
    "compliancePoliciesGrossUpRelated": [
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Office supplies, Software, Equipment",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": true,
        "gross_up_rule": "Business expenses might be subject to VAT of 5%"
      },
      {
        "travel_non_travel_both": "Non-Travel",
        "expense_type": "Mileage",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": false,
        "gross_up_rule": "There are no taxes applied to mileage reimbursements. Workers can submit reimbursements via expenses against receipts"
      },
      {
        "travel_non_travel_both": "Travel",
        "expense_type": "Hotel, Flight, Restaurant",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "gross_up": false,
        "gross_up_rule": "Domestic and international business travel has no specific tax treatment mentioned. Workers can be reimbursed via expenses against receipts and invoices"
      }
    ],
    "compliancePoliciesAdditionalInfoRelated": [
      {
        "travel_non_travel_both": "Both",
        "expense_type": "All expense types",
        "icp_name": "Local Employer (specific entity name not provided in document)",
        "additional_info_required": true,
        "additional_info_rule": "Manager approval required before expense reimbursement can be processed"
      }
    ]
  }
};
