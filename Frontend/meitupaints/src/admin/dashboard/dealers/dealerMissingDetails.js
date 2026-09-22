import { findMissingDetails } from "../../../utils/missingDetails.js";

export { isDetailMissing, joinDetailLabels } from "../../../utils/missingDetails.js";

// The company details every dealer record should carry - the six fields the
// Edit Dealer form collects. Shared so the desktop profile, its mobile view and
// the edit form all agree on what counts as "not entered yet".
export const DEALER_DETAIL_FIELDS = [
  { key: "companyName", label: "Company Name" },
  { key: "contactName", label: "Contact Person" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "panVat", label: "PAN/VAT Number" },
  { key: "address", label: "Address" },
];

export function missingDealerDetails(dealer) {
  return findMissingDetails(dealer, DEALER_DETAIL_FIELDS);
}
