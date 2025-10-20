// Create New Item Form with Image Upload
import { json, redirect, unstable_parseMultipartFormData } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, Form } from "@remix-run/react";
import { useState } from "react";
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
import { authenticate } from "../../shopify.server";
import { ItemModel } from "../../models/item.server";
import { CategoryModel } from "../../models/category.server";
import { ShopifyFilesService } from "../../services/shopify-files.server";

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
  const imageData = formData.get("imageData"); // Base64 image

  // Validation
  if (!name || name.trim().length === 0) {
    return json({ error: "Item name is required" }, { status: 400 });
  }

  if (!serialNumber || serialNumber.trim().length === 0) {
    return json({ error: "Serial number is required" }, { status: 400 });
  }

  // Check if serial number already exists
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

  // Upload image if provided
  if (imageData && imageData !== "null") {
    try {
      const filesService = new ShopifyFilesService(session);
      const buffer = ShopifyFilesService.base64ToBuffer(imageData);
      
      // Validate image size
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

  const handleDropZoneDrop = (_dropFiles, acceptedFiles, _rejectedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setImageFile(file);
      
      // Create preview
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("serialNumber", serialNumber);
    
    if (imagePreview) {
      formData.append("imageData", imagePreview);
    }

    // Submit using native form submission
    const form = e.target;
    const response = await fetch(form.action, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      navigate(`/app/categories/${category.id}/items`);
    }
  };

  const fileUpload = !imageFile && (
    <DropZone.FileUpload actionHint="Accepts .jpg and .png files" />
  );

  return (
    <Page
      title={`Add Item to ${category.name}`}
      backAction={{
        content: "Back to Items",
        onAction: () => navigate(`/app/categories/${category.id}/items`)
      }}
    >
      <Form method="post" onSubmit={handleSubmit}>
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
                placeholder="e.g., Rare Trading Card #42"
                requiredIndicator
                autoComplete="off"
              />

              <TextField
                label="Serial Number"
                name="serialNumber"
                value={serialNumber}
                onChange={setSerialNumber}
                placeholder="e.g., ABC-12345-XYZ"
                requiredIndicator
                helpText="This unique identifier will be used for customer verification"
                autoComplete="off"
              />

              <TextField
                label="Description"
                name="description"
                value={description}
                onChange={setDescription}
                placeholder="Optional description of this item"
                multiline={4}
                autoComplete="off"
              />

              <BlockStack gap="300">
                <Text variant="headingSm">Image</Text>
                
                {imagePreview ? (
                  <BlockStack gap="300">
                    <Thumbnail
                      source={imagePreview}
                      alt={name || "Item image"}
                      size="large"
                    />
                    <Button onClick={handleRemoveImage} tone="critical">
                      Remove Image
                    </Button>
                  </BlockStack>
                ) : (
                  <DropZone
                    accept="image/*"
                    type="image"
                    onDrop={handleDropZoneDrop}
                    allowMultiple={false}
                  >
                    {fileUpload}
                  </DropZone>
                )}
              </BlockStack>

              <InlineStack gap="300">
                <Button submit variant="primary">
                  Create Item
                </Button>
                <Button onClick={() => navigate(`/app/categories/${category.id}/items`)}>
                  Cancel
                </Button>
              </InlineStack>
            </FormLayout>
          </Card>
        </BlockStack>
      </Form>
    </Page>
  );
}