// Sale Clock Settings - Countdown Timer for Product Pages
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Select,
  RangeSlider,
  Box
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const settings = await WholesaleModel.getSettings(shopDomain);

  // Parse sale_clock_config from settings
  const saleClockConfig = settings?.sale_clock_config ?
    (typeof settings.sale_clock_config === 'string' ?
      JSON.parse(settings.sale_clock_config) :
      settings.sale_clock_config) :
    {
      enabled: false,
      bg_color: '#000000',
      fg_color: '#ffffff',
      text_align: 'left',
      font_size: 14,
      border_radius: 4
    };

  return json({ saleClockConfig });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();

  const saleClockConfig = {
    enabled: formData.get('enabled') === 'true',
    bg_color: formData.get('bg_color'),
    fg_color: formData.get('fg_color'),
    text_align: formData.get('text_align'),
    font_size: parseInt(formData.get('font_size')),
    border_radius: parseInt(formData.get('border_radius'))
  };

  try {
    // Update sale clock config in wholesale_settings
    await WholesaleModel.updateSettings(shopDomain, {
      sale_clock_config: JSON.stringify(saleClockConfig)
    });

    return json({ success: true, message: 'Sale clock settings saved!' });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function SaleClockSettings() {
  const { saleClockConfig } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();

  const [enabled, setEnabled] = useState(saleClockConfig.enabled);
  const [bgColor, setBgColor] = useState(saleClockConfig.bg_color);
  const [fgColor, setFgColor] = useState(saleClockConfig.fg_color);
  const [textAlign, setTextAlign] = useState(saleClockConfig.text_align);
  const [fontSize, setFontSize] = useState(saleClockConfig.font_size);
  const [borderRadius, setBorderRadius] = useState(saleClockConfig.border_radius);

  return (
    <Page
      title="Sale Clock"
      subtitle="Display countdown timer on product pages"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success && (
            <Banner status="success" onDismiss={() => {}}>
              <p>{actionData.message}</p>
            </Banner>
          )}

          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          <Form method="post">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Sale Clock Configuration</Text>

                <Checkbox
                  label="Enable Sale Clock"
                  checked={enabled}
                  onChange={setEnabled}
                  helpText="Show countdown timer on product pages for time-sensitive offers"
                />

                <input type="hidden" name="enabled" value={enabled.toString()} />

                {enabled && (
                  <BlockStack gap="400">
                    <FormLayout>
                      <TextField
                        label="Background Color"
                        name="bg_color"
                        value={bgColor}
                        onChange={setBgColor}
                        type="color"
                        autoComplete="off"
                        helpText="Color for timer background"
                      />

                      <TextField
                        label="Text Color"
                        name="fg_color"
                        value={fgColor}
                        onChange={setFgColor}
                        type="color"
                        autoComplete="off"
                        helpText="Color for timer text"
                      />

                      <Select
                        label="Text Alignment"
                        name="text_align"
                        options={[
                          { label: 'Left', value: 'left' },
                          { label: 'Center', value: 'center' },
                          { label: 'Right', value: 'right' }
                        ]}
                        value={textAlign}
                        onChange={setTextAlign}
                      />

                      <RangeSlider
                        label="Font Size"
                        name="font_size"
                        value={fontSize}
                        onChange={setFontSize}
                        min={10}
                        max={32}
                        output
                        suffix={
                          <p style={{
                            minWidth: '24px',
                            textAlign: 'right'
                          }}>
                            {fontSize}px
                          </p>
                        }
                      />

                      <RangeSlider
                        label="Border Radius"
                        name="border_radius"
                        value={borderRadius}
                        onChange={setBorderRadius}
                        min={0}
                        max={20}
                        output
                        suffix={
                          <p style={{
                            minWidth: '24px',
                            textAlign: 'right'
                          }}>
                            {borderRadius}px
                          </p>
                        }
                      />
                    </FormLayout>

                    {/* Preview */}
                    <Box>
                      <Text variant="headingMd" as="h3">Preview</Text>
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <div style={{
                          backgroundColor: bgColor,
                          color: fgColor,
                          textAlign: textAlign,
                          fontSize: `${fontSize}px`,
                          borderRadius: `${borderRadius}px`,
                          padding: '12px',
                          fontFamily: 'monospace'
                        }}>
                          Sale ends in 2 days, 1 hour, 59 minutes, 43 seconds
                        </div>
                      </Box>
                    </Box>

                    <InlineStack gap="200">
                      <Button
                        onClick={() => {
                          setBgColor('#000000');
                          setFgColor('#ffffff');
                          setTextAlign('left');
                          setFontSize(14);
                          setBorderRadius(4);
                        }}
                      >
                        Reset to Default
                      </Button>
                    </InlineStack>
                  </BlockStack>
                )}

                <Button variant="primary" submit>
                  Save Settings
                </Button>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">How It Works</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Displays countdown timer on product pages
                </Text>
                <Text variant="bodySm">
                  • Creates urgency for sales and promotions
                </Text>
                <Text variant="bodySm">
                  • Fully customizable styling
                </Text>
                <Text variant="bodySm">
                  • Works with pricing rule end dates
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Theme Integration</Text>
              <Text variant="bodySm">
                Add this Liquid code to your product template where you want the countdown to appear:
              </Text>
              <Box
                padding="300"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <Text variant="bodySm" fontFamily="mono">
                  {`{% render 'wholesale-sale-clock' %}`}
                </Text>
              </Box>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Snippet Code</Text>
              <Text variant="bodySm">
                Create a snippet file named <code>wholesale-sale-clock.liquid</code> with the sale clock HTML/JavaScript:
              </Text>
              <Box
                padding="300"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <Text variant="bodySm" fontFamily="mono">
                  {`<div id="sale-clock" style="background: ${bgColor}; color: ${fgColor}; text-align: ${textAlign}; font-size: ${fontSize}px; border-radius: ${borderRadius}px; padding: 12px;"></div>`}
                </Text>
              </Box>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Use Cases</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Flash sales with end dates
                </Text>
                <Text variant="bodySm">
                  • Limited-time wholesale pricing
                </Text>
                <Text variant="bodySm">
                  • Seasonal promotions
                </Text>
                <Text variant="bodySm">
                  • Early bird specials
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
