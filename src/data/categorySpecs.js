// Category Specification Templates Configuration

export const CATEGORY_SPEC_TEMPLATES = {
  clothing: [
    "Brand",
    "Material",
    "Color",
    "Size",
    "Fit Type",
    "Pattern",
    "Sleeve Type",
    "Neck Type",
    "Gender",
    "Occasion",
    "Country of Origin",
    "Wash Care"
  ],
  electronics: [
    "Brand",
    "Model",
    "Color",
    "RAM",
    "Storage",
    "Processor",
    "Operating System",
    "Screen Size",
    "Battery Capacity",
    "Connectivity",
    "Warranty",
    "Country of Origin"
  ],
  mobile: [
    "Brand",
    "Model",
    "RAM",
    "Internal Storage",
    "Display Size",
    "Processor",
    "Rear Camera",
    "Front Camera",
    "Battery Capacity",
    "Operating System",
    "SIM Type",
    "5G Support",
    "Warranty",
    "Country of Origin"
  ],
  furniture: [
    "Brand",
    "Material",
    "Color",
    "Dimensions",
    "Weight",
    "Seating Capacity",
    "Shape",
    "Room Type",
    "Assembly Required",
    "Warranty",
    "Country of Origin"
  ],
  grocery: [
    "Brand",
    "Net Quantity",
    "Ingredients",
    "Dietary Preference",
    "Shelf Life",
    "Expiry",
    "Country of Origin",
    "Storage Instructions"
  ],
  beauty: [
    "Brand",
    "Product Type",
    "Skin Type",
    "Form",
    "Net Quantity",
    "Ingredients",
    "Fragrance",
    "Benefits",
    "Expiry",
    "Country of Origin"
  ],
  default: [
    "Brand",
    "Model",
    "Material",
    "Color",
    "Weight",
    "Warranty",
    "Country of Origin"
  ]
};

/**
 * Returns recommended specification field names based on category name/ID.
 */
export function getRecommendedSpecs(categoryName = "", subcategoryName = "") {
  const combined = `${categoryName} ${subcategoryName}`.toLowerCase();

  if (combined.includes("cloth") || combined.includes("apparel") || combined.includes("fashion") || combined.includes("wear") || combined.includes("shirt") || combined.includes("pant") || combined.includes("dress")) {
    return CATEGORY_SPEC_TEMPLATES.clothing;
  }
  if (combined.includes("mobile") || combined.includes("phone") || combined.includes("smartphone")) {
    return CATEGORY_SPEC_TEMPLATES.mobile;
  }
  if (combined.includes("electron") || combined.includes("laptop") || combined.includes("computer") || combined.includes("gadget") || combined.includes("appliances")) {
    return CATEGORY_SPEC_TEMPLATES.electronics;
  }
  if (combined.includes("furnit") || combined.includes("home") || combined.includes("table") || combined.includes("chair") || combined.includes("decor")) {
    return CATEGORY_SPEC_TEMPLATES.furniture;
  }
  if (combined.includes("groc") || combined.includes("food") || combined.includes("snack") || combined.includes("beverage")) {
    return CATEGORY_SPEC_TEMPLATES.grocery;
  }
  if (combined.includes("beaut") || combined.includes("personal") || combined.includes("skin") || combined.includes("care") || combined.includes("cosmetic")) {
    return CATEGORY_SPEC_TEMPLATES.beauty;
  }

  return CATEGORY_SPEC_TEMPLATES.default;
}
