import { json } from "@remix-run/node";
import { Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Frame, Navigation, TopBar } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  return json({
    shopDomain: session.shop
  });
};

export default function AppLayout() {
  const { shopDomain } = useLoaderData();
  const location = useLocation();
  const [mobileNavigationActive, setMobileNavigationActive] = useState(false);
  const skipToContentRef = useRef(null);

  const toggleMobileNavigationActive = useCallback(
    () => setMobileNavigationActive((prev) => !prev),
    []
  );

  const userMenuMarkup = useMemo(() => (
    <TopBar.UserMenu
      initials={shopDomain ? shopDomain[0]?.toUpperCase() : "S"}
      name={shopDomain || "Shopify"}
      actions={[
        {
          items: [
            {
              content: "Log out",
              url: "/auth/logout"
            }
          ]
        }
      ]}
    />
  ), [shopDomain]);

  const topBarMarkup = useMemo(() => (
    <TopBar
      showNavigationToggle
      onNavigationToggle={toggleMobileNavigationActive}
      userMenu={userMenuMarkup}
    />
  ), [toggleMobileNavigationActive, userMenuMarkup]);

  const navigationMarkup = useMemo(() => (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          { label: "Dashboard", url: "/app" },
          { label: "Categories", url: "/app/categories" },
          { label: "Billing", url: "/app/billing" }
        ]}
      />
    </Navigation>
  ), [location.pathname]);

  return (
    <Frame
      topBar={topBarMarkup}
      navigation={navigationMarkup}
      showMobileNavigation={mobileNavigationActive}
      onNavigationDismiss={toggleMobileNavigationActive}
      skipToContentTarget={skipToContentRef}
    >
      <div ref={skipToContentRef} style={{ padding: "var(--p-space-500)" }}>
        <Outlet />
      </div>
    </Frame>
  );
}
