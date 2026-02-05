/**
 * Hardcoded list of supported ICPs (In-Country Partners) for expense processing.
 * Add new ICPs here when they are added to the database.
 *
 * Total: 53 ICPs extracted from country-policies.seed.ts
 */
export enum Icp {
    // Brazil
    APEX_AMERICA_BRASIL_SERVICOS_DE_COMUNICACAO_LTDA = 'APEX AMERICA BRASIL SERVICOS DE COMUNICACAO LTDA',
    SGF_GLOBAL_BRASIL_RECRUTAMENTO_E_SELECAO_LTDA_EPP = 'SGF GLOBAL BRASIL RECRUTAMENTO E SELECAO LTDA-EPP',

    // Chile
    SGF_GLOBAL_CHILE_SPA = 'SGF Global Chile SPA',

    // China
    GOGLOBAL_CHINA = 'GoGlobal China',
    SHANGHAI_YANYAN = '上海炎焰企业管理有限公司',

    // Colombia
    MSP_COLOMBIA_SAS = 'MSP COLOMBIA SAS',
    SGF_GLOBAL_EMPRESA_DE_SERVICIOS_TEMPORALES_S_SAS = 'SGF GLOBAL EMPRESA DE SERVICIOS TEMPORALES S SAS',

    // Denmark
    GLOBAL_PEOPLE_VENSURE_GLOBAL_EOR_DNK_APS = 'Global People (Vensure Global EOR DNK ApS)',

    // France
    GOGLOBAL_FRANCE = 'GoGlobal France',

    // Germany / Austria / Belgium
    GLOBAL_PEOPLE_IT_SERVICES_GMBH = 'Global People IT-Services GmbH',
    GOGLOBAL_EUROPE_GMBH = 'GoGlobal Europe GmbH',

    // India
    AMERICAN_EPAY_SERVICES_PVT_LTD = 'American EPAY Services Pvt Ltd',

    // Indonesia / Philippines / SE Asia
    AYP = 'AYP',
    AYP_HR_GROUP_CO = 'AYP HR GROUP CO.',
    AYP_HR_GROUP_COMPANY_LIMITED = 'AYP HR GROUP COMPANY LIMITED',
    AYP_STAFFING_PTE_LTD = 'AYP STAFFING PTE LTD',
    TIGER = 'Tiger',
    TIGER_CONSULTING = 'Tiger Consulting',
    TIGER_CONSULTING_SDN_BHD = 'TIGER CONSULTING SDN BHD',
    TIGER_CONSULTING_G_SDN_BHD = 'TIGER CONSULTING G SDN BHD',

    // Italy
    GLOBAL_PEOPLE_SRL = 'Global People s.r.l.',
    GOGLOBAL_CONSULTING_SRL = 'GoGlobal Consulting S.r.l',

    // Lithuania / Czech Republic
    GLOBAL_PEOPLE_CZ_SRO = 'Global People CZ s.r.o.',

    // Singapore / Thailand
    RJ_SUPPLY_AND_SERVICE_CO = 'RJ Supply and Service Co.',

    // Switzerland
    GLOBAL_PPL_CH_GMBH = 'Global PPL CH GmbH',

    // United Kingdom
    GLOBAL_PEOPLE_UK_LIMITED = 'Global People UK Limited',
    PARAKAR_UK_LIMITED = 'Parakar UK Limited',

    // Vietnam
    CONG_TY_SIGMA = 'CÔNG TY TNHH DỊCH VỤ SIGMA',
    CONG_TY_TIGER_CONSULTING = 'CÔNG TY TNHH TIGER CONSULTING',
    CONG_TY_TIGER_CONSULTING_VIET_NAM = 'CÔNG TY TNHH TIGER CONSULTING VIỆT NAM',
    GOGLOBAL_VIETNAM_COMPANY_LIMITED = 'GOGLOBAL VIETNAM COMPANY LIMITED',

    // Global / Multi-country ICPs
    ATLAS = 'Atlas',
    BALDOCK = 'Baldock',
    EOS = 'EoS',
    EUROFAST_GLOBAL_LTD = 'Eurofast Global Ltd',
    EXTERSUS = 'Extersus',
    GLOBAL_PEOPLE = 'Global People',
    GOGLOBAL = 'GoGlobal',
    GOGLOBAL_LOWERCASE = 'goGlobal',
    LOCAL_EMPLOYER = 'Local Employer',
    LOCAL_EMPLOYER_SPECIFIC = 'Local Employer (specific entity name not provided in document)',
    LOCAL_SERVICE_PROVIDER = 'Local service provider',
    LOCAL_SERVICE_PROVIDER_LOWERCASE = 'local service provider',
    PAPAYA = 'Papaya',
    PAPAYA_PARTNER_EOS = 'Papaya Partner EoS',
    PARAKAR = 'Parakar',
    PEOPLE_2_0 = 'People 2.0',
    PROCLOZ = 'Procloz',
}

/**
 * Array of all supported ICP values for dropdown/validation use.
 */
export const ICPS = Object.values(Icp);
