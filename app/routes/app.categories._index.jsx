import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  Badge,
  EmptyState
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { CategoryModel } from "../models/category.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const categories = await CategoryModel.findAll(session.shop);
  
  return json({ categories });
};

export default function CategoriesIndex() {
  const { categories } = useLoaderData();
  const navigate = useNavigate();

  if (categories.length === 0) {
    return (
      <Page title="Categories" backAction={{ url: "/app" }}>
        <EmptyState
          heading="No categories yet"
          action={{
            content: "Create Category",
            onAction: () => navigate("/app/categories/new")
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Create your first category to start tracking collectibles.</p>
        </EmptyState>
      </Page>
    );
  }

  const rows = categories.map((category) => [
    category.name,
    category.description || "—",
    <Badge tone={category.is_active ? "success" : "warning"}>
      {category.is_active ? "Active" : "Inactive"}
    </Badge>,
    `${category.item_count || 0} items`,
    <Button onClick={() => navigate(`/app/categories/${category.id}/items`)}>
      View Items
    </Button>
  ]);

  return (
    <Page
      title="Categories"
      backAction={{ url: "/app" }}
      primaryAction={{
        content: "Create Category",
        onAction: () => navigate("/app/categories/new")
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={["Name", "Description", "Status", "Items", "Actions"]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
