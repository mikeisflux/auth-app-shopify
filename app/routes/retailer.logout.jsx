// Retailer Logout
import { LoaderFunction } from "@remix-run/node";
import { RetailerAuth } from "../services/retailer-auth.server";

export const loader: LoaderFunction = async ({ request }) => {
  return await RetailerAuth.logout(request);
};

export default function RetailerLogout() {
  return null;
}
