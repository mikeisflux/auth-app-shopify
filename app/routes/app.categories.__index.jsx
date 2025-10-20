// Categories List Page with Search, Sort, and Filter
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, Form } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  DataTable,
  Button,
  TextField,
  Select,
  InlineStack,
  BlockStack,
  Badge,
  Modal,
  Text
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { CategoryModel } from "../models/category.server";
import { ShopModel } from "../models/shop.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortOrder = url.searchParams.get("sortOrder") || "DESC";
  const showInactive = url.searchParams.get("showInactive") === "true";

  let categories = await CategoryModel.findAll(shopDomain, showInactive);

  // Apply search filter
  if (search) {
    categories = categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(search.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(search.toLowerCase()))
    );
  }

  // Apply sorting
  categories.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortBy === "created_at" || sortBy === "updated_at") {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }

    if (sortOrder === "ASC") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const canCreateMore = await ShopModel.canCreateCategory(shopDomain);
  const categoryCount = await ShopModel.getCategoryCount(shopDomain);
  const subscription = await ShopModel.getSubscription(shopDomain);

  return json({
    categories,
    canCreateMore,
    categoryCount,
    subscription,
    filters: { search, sortBy, sortOrder, showInactive }
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const action = formData.get("action");
  const categoryId = formData.get("categoryId");

  if (action === "delete") {
    await CategoryModel.hardDelete(categoryId, shopDomain);
  } else if (action === "toggle") {
    const isActive = formData.get("isActive") === "true";
    await CategoryModel.update(categoryId, shopDomain, { isActive: !isActive });
  }

  return json({ success: true });
};

export default function CategoriesIndex() {
  const { categories, canCreateMore, categoryCount, subscription, filters } =
    useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [search, setSearch] = useState(filters.search);
  const [sortBy, setSortBy] = useState(filters.sortBy);
  const [sortOrder, setSortOrder] = useState(filters.sortOrder);
  const [showInactive, setShowInactive] = useState(filters.showInactive);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
  }, []);

  const handleApplyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    if (showInactive) params.set("showInactive", "true");

    navigate(`/app/categories?${params.toString()}`);
  }, [search, sortBy, sortOrder, showInactive, navigate]);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setSortBy("created_at");
    setSortOrder("DESC");
    setShowInactive(false);
    navigate("/app/categories");
  }, [navigate]);

  const handleDelete = useCallback((category) => {
    setCategoryToDelete(category);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (categoryToDelete) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("categoryId", categoryToDelete.id);
      submit(formData, { method: "post" });
      setDeleteModalOpen(false);
      setCategoryToDelete(null);
    }
  }, [categoryToDelete, submit]);

  const handleToggleActive = useCallback(
    (category) => {
      const formData = new FormData();
      formData.append("action", "toggle");
      formData.append("categoryId", category.id);
      formData.append("isActive", category.is_active.toString());
      submit(formData, { method: "post" });
    },
    [submit]
  );

  const rows = categories.map((category) => [
    category.name,
    category.description || "-",
    category.item_count,
    category.is_active ? (
      <Badge tone="success">Active</Badge>
    ) : (
      <Badge>Inactive</Badge>
    ),
    new Date(category.created_at).toLocaleDateString(),
    <InlineStack gap="200">
      <Button
        size="slim"
        onClick={() => navigate(`/app/categories/${category.id}/items`)}
      >
        View Items
      </Button>
      <Button
        size="slim"
        onClick={() => navigate(`/app/categories/${category.id}/edit`)}
      >
        Edit
      </Button>
      <Button
        size="slim"
        tone="critical"
        onClick={() => handleDelete(category)}
      >
        Delete
      </Button>
    </InlineStack>,
  ]);

  const planLimitMessage = subscription?.subscription_plan
    ? `You have ${categoryCount} categories. Your plan allows ${
        subscription.subscription_plan === "BASIC_9_99"
          ? "2"
          : subscription.subscription_plan === "PRO_29_99"
          ? "5"
          : "unlimited"
      }.`
    : "No active subscription.";

  return (
    <Page
      title="Categories"
      primaryAction={
        canCreateMore
          ? {
              content: "Create Category",
              onAction: () => navigate("/app/categories/new"),
            }
          : undefined
      }
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingSm">Filters & Search</Text>

            <InlineStack gap="400" wrap={false}>
              <div style={{ flexGrow: 1 }}>
                <TextField
                  label="Search categories"
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search by name or description"
                  autoComplete="off"
                />
              </div>
              <Select
                label="Sort by"
                options={[
                  { label: "Name", value: "name" },
                  { label: "Created Date", value: "created_at" },
                  { label: "Updated Date", value: "updated_at" },
                  { label: "Item Count", value: "item_count" },
                ]}
                value={sortBy}
                onChange={setSortBy}
              />
              <Select
                label="Order"
                options={[
                  { label: "Ascending", value: "ASC" },
                  { label: "Descending", value: "DESC" },
                ]}
                value={sortOrder}
                onChange={setSortOrder}
              />
            </InlineStack>

            <InlineStack gap="300">
              <Button onClick={handleApplyFilters} variant="primary">
                Apply Filters
              </Button>
              <Button onClick={handleClearFilters}>Clear</Button>
              <div style={{ marginLeft: "auto" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    style={{ marginRight: "8px" }}
                  />
                  Show Inactive
                </label>
              </div>
            </InlineStack>

            <Text variant="bodySm" tone="subdued">
              {planLimitMessage}
            </Text>
          </BlockStack>
        </Card>

        <Card>
          {categories.length > 0 ? (
            <DataTable
              columnContentTypes={["text", "text", "numeric", "text", "text", "text"]}
              headings={[
                "Name",
                "Description",
                "Items",
                "Status",
                "Created",
                "Actions",
              ]}
              rows={rows}
            />
          ) : (
            <BlockStack gap="300">
              <Text tone="subdued">
                No categories found. Create your first category to get started!
              </Text>
              {canCreateMore && (
                <Button
                  variant="primary"
                  onClick={() => navigate("/app/categories/new")}
                >
                  Create First Category
                </Button>
              )}
            </BlockStack>
          )}
        </Card>
      </BlockStack>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Category"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: confirmDelete,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text>
            Are you sure you want to delete "{categoryToDelete?.name}"? This will
            also delete all items in this category. This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}