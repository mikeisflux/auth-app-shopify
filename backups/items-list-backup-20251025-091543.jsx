// Items List for a Category with Search, Sort, Filter
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
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
  Text,
  Thumbnail
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { ItemModel } from "../models/item.server";
import { CategoryModel } from "../models/category.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { categoryId } = params;

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortOrder = url.searchParams.get("sortOrder") || "DESC";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 50;

  const category = await CategoryModel.findById(categoryId, shopDomain);
  
  if (!category) {
    throw new Response("Category not found", { status: 404 });
  }

  const itemsData = await ItemModel.findAll(shopDomain, {
    categoryId,
    search,
    sortBy,
    sortOrder,
    isActive: true,
    limit,
    offset: (page - 1) * limit
  });

  return json({
    category,
    items: itemsData.items,
    total: itemsData.total,
    page,
    totalPages: Math.ceil(itemsData.total / limit),
    filters: { search, sortBy, sortOrder }
  });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const action = formData.get("action");
  const itemId = formData.get("itemId");

  if (action === "delete") {
    await ItemModel.delete(itemId, shopDomain);
  }

  return json({ success: true });
};

export default function CategoryItems() {
  const { category, items, total, page, totalPages, filters } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [search, setSearch] = useState(filters.search);
  const [sortBy, setSortBy] = useState(filters.sortBy);
  const [sortOrder, setSortOrder] = useState(filters.sortOrder);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
  }, []);

  const handleApplyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.set("page", "1");

    navigate(`/app/categories/${category.id}/items?${params.toString()}`);
  }, [search, sortBy, sortOrder, category.id, navigate]);

  const handlePageChange = useCallback(
    (newPage) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", newPage.toString());

      navigate(`/app/categories/${category.id}/items?${params.toString()}`);
    },
    [search, sortBy, sortOrder, category.id, navigate]
  );

  const handleDelete = useCallback((item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (itemToDelete) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("itemId", itemToDelete.id);
      submit(formData, { method: "post" });
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  }, [itemToDelete, submit]);

  const rows = items.map((item) => [
    item.image_url ? (
      <Thumbnail source={item.image_url} alt={item.name} size="small" />
    ) : (
      <Thumbnail source="" alt="No image" size="small" />
    ),
    item.name,
    item.serial_number,
    item.description?.substring(0, 50) + (item.description?.length > 50 ? "..." : "") || "-",
    item.verification_count || 0,
    item.created_at.split("T")[0],
    <InlineStack gap="200">
      <Button
        size="slim"
        onClick={() => navigate(`/app/items/${item.id}/edit`)}
      >
        Edit
      </Button>
      <Button
        size="slim"
        tone="critical"
        onClick={() => handleDelete(item)}
      >
        Delete
      </Button>
    </InlineStack>,
  ]);

  return (
    <Page
      title={`${category.name} - Items`}
      subtitle={category.description}
      primaryAction={{
        content: "Add Item",
        onAction: () => navigate(`/app/categories/${category.id}/items/new`),
      }}
      backAction={{
        content: "Categories",
        url: "/app/categories",
      }}
    >
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingSm">Search & Filter Items</Text>

            <InlineStack gap="400" wrap={false}>
              <div style={{ flexGrow: 1 }}>
                <TextField
                  label="Search items"
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search by name, serial number, or description"
                  autoComplete="off"
                />
              </div>
              <Select
                label="Sort by"
                options={[
                  { label: "Name", value: "name" },
                  { label: "Serial Number", value: "serial_number" },
                  { label: "Created Date", value: "created_at" },
                  { label: "Verification Count", value: "verification_count" },
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

            <Button onClick={handleApplyFilters} variant="primary">
              Apply Filters
            </Button>

            <Text variant="bodySm" tone="subdued">
              Showing {items.length} of {total} items
            </Text>
          </BlockStack>
        </Card>

        <Card>
          {items.length > 0 ? (
            <>
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "numeric",
                  "text",
                  "text",
                ]}
                headings={[
                  "Image",
                  "Name",
                  "Serial Number",
                  "Description",
                  "Verifications",
                  "Created",
                  "Actions",
                ]}
                rows={rows}
              />

              {totalPages > 1 && (
                <div style={{ padding: "16px", textAlign: "center" }}>
                  <InlineStack gap="200" align="center">
                    <Button
                      disabled={page === 1}
                      onClick={() => handlePageChange(page - 1)}
                    >
                      Previous
                    </Button>
                    <Text>
                      Page {page} of {totalPages}
                    </Text>
                    <Button
                      disabled={page === totalPages}
                      onClick={() => handlePageChange(page + 1)}
                    >
                      Next
                    </Button>
                  </InlineStack>
                </div>
              )}
            </>
          ) : (
            <BlockStack gap="300">
              <Text tone="subdued">
                No items in this category yet. Add your first collectible!
              </Text>
              <Button
                variant="primary"
                onClick={() => navigate(`/app/categories/${category.id}/items/new`)}
              >
                Add First Item
              </Button>
            </BlockStack>
          )}
        </Card>
      </BlockStack>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Item"
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
            Are you sure you want to delete "{itemToDelete?.name}" (Serial: {itemToDelete?.serial_number})? 
            This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}