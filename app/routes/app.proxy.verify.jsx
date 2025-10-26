// App Proxy Route - Storefront Serial Number Verification
import { json } from "@remix-run/node";
import { ItemModel } from "../models/item.server";

export const action = async ({ request }) => {
  // Verify this is a valid App Proxy request from Shopify
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  if (!shop) {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  // Get serial number from request
  const body = await request.json();
  const { serial_number } = body;

  if (!serial_number || serial_number.trim().length === 0) {
    return json({ error: "Serial number is required" }, { status: 400 });
  }

  try {
    // Look up item by serial number
    const item = await ItemModel.findBySerialNumber(
      serial_number.trim(),
      shop
    );

    if (!item) {
      return json({ 
        error: "Serial number not found", 
        found: false 
      }, { status: 404 });
    }

    // Log the verification
    const clientIp = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await ItemModel.logVerification(item.id, clientIp, userAgent);

    // Return item information
    return json({
      found: true,
      item: {
        id: item.id,
        name: item.name,
        description: item.description,
        serial_number: item.serial_number,
        image_url: item.image_url,
        category_name: item.category_name,
        verification_count: item.verification_count + 1, // Include the current verification
        verified_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Verification error:", error);
    return json({ 
      error: "An error occurred during verification" 
    }, { status: 500 });
  }
};

// Handle GET requests (for testing)
export const loader = async () => {
  return json({ 
    message: "Collectibles verification endpoint. Use POST to verify serial numbers." 
  });
};