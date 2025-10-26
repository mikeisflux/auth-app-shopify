import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigate, Form } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { CategoryModel } from "../models/category.server";
import { ShopModel } from "../models/shop.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const canCreate = await ShopModel.canCreateCategory(shopDomain);
  
  if (!canCreate) {
    return json({
      error: "You have reached your category limit. Please upgrade your plan."
    }, { status: 400 });
  }

  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description");
  const displayOrder = formData.get("displayOrder");

  if (!name || name.trim().length === 0) {
    return json({ error: "Category name is required" }, { status: 400 });
  }

  try {
    await CategoryModel.create(shopDomain, {
      name: name.trim(),
      description: description?.trim() || null,
      displayOrder: displayOrder ? parseInt(displayOrder) : 0
    });

    return redirect("/app/categories");
  } catch (error) {
    console.error("Error creating category:", error);
    
    if (error.message.includes("unique")) {
      return json({
        error: "A category with this name already exists"
      }, { status: 400 });
    }
    
    return json({
      error: "Failed to create category. Please try again."
    }, { status: 500 });
  }
};

export default function NewCategory() {
  const actionData = useActionData();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");

  return (
    <Page
      title="Create Category"
      backAction={{
        content: "Categories",
        onAction: () => navigate("/app/categories")
      }}
    >
      <Form method="post">
        <BlockStack gap="500">
          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          <Card>
            <FormLayout>
              <TextField
                label="Category Name"
                name="name"
                value={name}
                onChange={setName}
                placeholder="e.g., Limited Edition Prints"
                requiredIndicator
                autoComplete="off"
              />

              <TextField
                label="Description"
                name="description"
                value={description}
                onChange={setDescription}
                placeholder="Optional description for this category"
                multiline={3}
                autoComplete="off"
              />

              <TextField
                label="Display Order"
                name="displayOrder"
                type="number"
                value={displayOrder}
                onChange={setDisplayOrder}
                helpText="Lower numbers appear first"
                autoComplete="off"
              />

              <BlockStack gap="300">
                <Button submit variant="primary">
                  Create Category
                </Button>
                <Button onClick={() => navigate("/app/categories")}>
                  Cancel
                </Button>
              </BlockStack>
            </FormLayout>
          </Card>
        </BlockStack>
      </Form>
    </Page>
  );
}