# Prompt Version Changelog

This document tracks changes to AI agent prompts to facilitate debugging, rollback decisions, and understanding the evolution of prompt engineering.

## Issue Detection Prompt

### Version 4 (Current)
**Date**: 2026-01-19
**Changes**:
- Added critical rule matching requirements section
- Implemented strict validation rules to prevent LLM hallucinations
- Added examples of correct vs incorrect issue generation
- Enhanced knowledge_base_reference requirements to enforce exact quotes
- Added explicit instruction: "Your issue description MUST ONLY describe what the cited rule explicitly requires"
- Added warning against inferring additional requirements not stated in rules

**Rationale**: 
- Addresses VAT hallucination issues where LLM was generating issues not supported by compliance data
- Implements post-LLM validation strategy with clearer prompt instructions
- Improves accuracy by requiring exact rule matching

**Related Changes**:
- Added `issue-validation.util.ts` for post-LLM validation
- Updated `IssueDetectionResultSchema` to include `validation_metadata`

### Version 3
**Date**: [To be documented]
**Changes**: [To be documented from git history]

### Version 2
**Date**: [To be documented]
**Changes**: [To be documented from git history]

### Version 1
**Date**: [To be documented]
**Changes**: Initial version

---

## Citation Generation Prompt

### Current Version
**Date**: [To be documented]
**Changes**: [To be documented]

---

## Data Extraction Prompt

### Current Version
**Date**: [To be documented]
**Changes**: [To be documented]

---

## File Classification Prompt

### Current Version
**Date**: [To be documented]
**Changes**: [To be documented]

---

## Image Quality Assessment Prompt

### Current Version
**Date**: [To be documented]
**Changes**: [To be documented]

---

## Document Splitter Prompt

### Current Version
**Date**: [To be documented]
**Changes**: [To be documented]

---

## Changelog Guidelines

When updating prompts:

1. **Increment the version number** in the prompt JSON file
2. **Document the change** in this changelog with:
   - Version number
   - Date of change
   - Detailed list of changes
   - Rationale for the change
   - Related code/schema changes
3. **Reference related issues** or pull requests if applicable
4. **Include examples** if the change affects output format

This helps with:
- Debugging issues related to prompt changes
- Understanding when and why specific rules were added
- Making informed rollback decisions
- Onboarding new team members
