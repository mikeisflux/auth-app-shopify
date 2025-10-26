// Create New Item Form with Image Upload
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, Form } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Banner,
  DropZone,
  Thumbnail,
  Text,
  InlineStack
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { ItemModel } from "../models/item.server";
import { CategoryModel } from "../models/category.server";
import { ShopifyFilesService } from "../services/shopify-files.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { categoryId } = params;

  const category = await CategoryModel.findById(categoryId, shopDomain);

  if (!category) {
    throw new Response("Category not found", { status: 404 });
  }

  return json({ category });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { categoryId } = params;

  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description");
  const serialNumber = formData.get("serialNumber");
  const imageData = formData.get("imageData");

  if (!name || name.trim().length === 0) {
    return json({ error: "Item name is required" }, { status: 400 });
  }

  if (!serialNumber || serialNumber.trim().length === 0) {
    return json({ error: "Serial number is required" }, { status: 400 });
  }

  const exists = await ItemModel.serialNumberExists(
    serialNumber.trim(),
    shopDomain
  );

  if (exists) {
    return json({
      error: "This serial number already exists. Please use a unique serial number."
    }, { status: 400 });
  }

  let imageUrl = null;
  let shopifyFileId = null;

  if (imageData && imageData !== "null" && imageData.trim() !== "") {
    try {
      const filesService = new ShopifyFilesService(session);
      const buffer = ShopifyFilesService.base64ToBuffer(imageData);

      if (!ShopifyFilesService.validateImage(buffer, 10)) {
        return json({
          error: "Image is too large. Maximum size is 10MB."
        }, { status: 400 });
      }

      const result = await filesService.uploadImage(
        buffer,
        `${serialNumber}.jpg`,
        "image/jpeg"
      );

      imageUrl = result.url;
      shopifyFileId = result.fileId;
    } catch (error) {
      console.error("Error uploading image:", error);
      return json({
        error: "Failed to upload image. Please try again."
      }, { status: 500 });
    }
  }

  try {
    await ItemModel.create(shopDomain, {
      categoryId,
      name: name.trim(),
      description: description?.trim() || null,
      serialNumber: serialNumber.trim(),
      imageUrl,
      shopifyFileId,
      additionalInfo: {}
    });

    return redirect(`/app/categories/${categoryId}/items`);
  } catch (error) {
    console.error("Error creating item:", error);
    return json({
      error: "Failed to create item. Please try again."
    }, { status: 500 });
  }
};

export default function NewItem() {
  const { category } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Only run client-side code after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDropZoneDrop = (_dropFiles, acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file && typeof window !== 'undefined') {
      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <Page
      title={`Add Item to ${category.name}`}
      backAction={{
        content: "Back to Items",
        onAction: () => navigate(`/app/categories/${category.id}/items`)
      }}
    >
      <Form method="post">
        <input type="hidden" name="imageData" value={imagePreview || ""} />
        <BlockStack gap="500">
          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          <Card>
            <FormLayout>
              <TextField
                label="Item Name"
                name="name"
                value={name}
                onChange={setName}
                placeholder="e.g., Signed Rookie Card"
                requiredIndicator
                autoComplete="off"
              />

              <TextField
                label="Description"
                name="description"
                value={description}
                onChange={setDescription}
                placeholder="Optional description for this item"
                multiline={3}
                autoComplete="off"
              />

              <TextField
                label="Serial Number"
                name="serialNumber"
                value={serialNumber}
                onChange={setSerialNumber}
                placeholder="Unique serial number"
                requiredIndicator
                autoComplete="off"
              />

              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Item Image
                </Text>

                <DropZone accept="image/*" type="image" onDrop={handleDropZoneDrop}>
                  {imagePreview ? (
                    <BlockStack gap="200">
                      <Thumbnail source={imagePreview} alt="Preview" size="large" />
                      <InlineStack gap="200">
                        <Button onClick={handleRemoveImage}>Remove image</Button>
                      </InlineStack>
                    </BlockStack>
                  ) : (
                    <DropZone.FileUpload actionHint="Accepts .jpg and .png files" />
                  )}
                </DropZone>
              </BlockStack>

              <BlockStack gap="300">
                <Button submit variant="primary">
                  Create Item
                </Button>
                <Button onClick={() => navigate(`/app/categories/${category.id}/items`)}>
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
