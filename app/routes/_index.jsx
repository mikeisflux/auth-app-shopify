import { redirect } from "@remix-run/node";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  // If there's a shop parameter, redirect to app
  if (shop) {
    return redirect(`/app?${url.searchParams.toString()}`);
  }
  
  // Otherwise, continue to landing page
  return null;
}

export default function Index() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Verify My Collectible - Professional Authentication for Your Shopify Store</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }
          
          .hero {
            text-align: center;
            padding: 4rem 2rem;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            margin-bottom: 3rem;
          }
          
          .hero h1 {
            font-size: 3.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 1rem;
          }
          
          .hero .tagline {
            font-size: 1.5rem;
            color: #666;
            margin-bottom: 2rem;
          }
          
          .cta-button {
            display: inline-block;
            padding: 18px 48px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-size: 1.2rem;
            font-weight: 600;
            transition: transform 0.3s, box-shadow 0.3s;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
          }
          
          .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(102, 126, 234, 0.6);
          }
          
          .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
          }
          
          .feature-card {
            background: white;
            padding: 2.5rem;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s;
          }
          
          .feature-card:hover {
            transform: translateY(-10px);
          }
          
          .feature-card h3 {
            font-size: 1.5rem;
            color: #667eea;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
          }
          
          .feature-card .icon {
            font-size: 2.5rem;
            margin-right: 1rem;
          }
          
          .feature-card p {
            color: #666;
            font-size: 1.1rem;
          }
          
          .benefits {
            background: white;
            padding: 4rem 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            margin-top: 3rem;
            text-align: center;
          }
          
          .benefits h2 {
            font-size: 2.5rem;
            color: #667eea;
            margin-bottom: 2rem;
          }
          
          .benefits-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
          }
          
          .benefit-item {
            padding: 1.5rem;
          }
          
          .benefit-item .number {
            font-size: 3rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .benefit-item h4 {
            font-size: 1.3rem;
            margin: 1rem 0;
            color: #1a1a1a;
          }
          
          .benefit-item p {
            color: #666;
          }
          
          footer {
            text-align: center;
            padding: 3rem 2rem;
            color: white;
            font-size: 1.1rem;
          }
          
          @media (max-width: 768px) {
            .hero h1 {
              font-size: 2.5rem;
            }
            
            .hero .tagline {
              font-size: 1.2rem;
            }
            
            .features {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="hero">
            <h1>🏆 Verify My Collectible</h1>
            <p className="tagline">Professional Authentication System for Your Shopify Store</p>
            <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
              Build customer trust with transparent verification and tracking of every collectible item you sell.
            </p>
            <a href="https://apps.shopify.com" className="cta-button">
              Install Now - Start Free Trial
            </a>
          </div>
          
          <div className="features">
            <div className="feature-card">
              <h3><span className="icon">📦</span> Smart Categories</h3>
              <p>Organize your collectibles into custom categories with drag-and-drop simplicity. Perfect for cards, memorabilia, art, and more.</p>
            </div>
            
            <div className="feature-card">
              <h3><span className="icon">🔐</span> Serial Number Tracking</h3>
              <p>Every item gets a unique serial number for complete authenticity tracking. Your customers know exactly what they're getting.</p>
            </div>
            
            <div className="feature-card">
              <h3><span className="icon">📸</span> High-Quality Images</h3>
              <p>Store unlimited photos of each collectible using Shopify's secure file system. Show every angle and detail.</p>
            </div>
            
            <div className="feature-card">
              <h3><span className="icon">✅</span> Customer Verification</h3>
              <p>Beautiful storefront widget lets customers verify their purchases instantly. Build trust and reduce fraud.</p>
            </div>
            
            <div className="feature-card">
              <h3><span className="icon">📊</span> Analytics Dashboard</h3>
              <p>Track verification requests, popular items, and customer engagement. Make data-driven decisions.</p>
            </div>
            
            <div className="feature-card">
              <h3><span className="icon">💳</span> Flexible Billing</h3>
              <p>Multiple pricing tiers to match your business size. Start small and scale as you grow.</p>
            </div>
          </div>
          
          <div className="benefits">
            <h2>Why Merchants Love Us</h2>
            <div className="benefits-grid">
              <div className="benefit-item">
                <div className="number">95%</div>
                <h4>Customer Satisfaction</h4>
                <p>Buyers trust verified collectibles more than unverified items</p>
              </div>
              
              <div className="benefit-item">
                <div className="number">3x</div>
                <h4>Faster Setup</h4>
                <p>Get your verification system running in minutes, not days</p>
              </div>
              
              <div className="benefit-item">
                <div className="number">24/7</div>
                <h4>Automatic Verification</h4>
                <p>Customers verify purchases anytime without your intervention</p>
              </div>
              
              <div className="benefit-item">
                <div className="number">∞</div>
                <h4>Unlimited Items</h4>
                <p>No limits on how many collectibles you can track and verify</p>
              </div>
            </div>
            
            <div style={{ marginTop: '3rem' }}>
              <a href="https://apps.shopify.com" className="cta-button">
                Get Started Today
              </a>
            </div>
          </div>
        </div>
        
        <footer>
          <p>© 2025 Verify My Collectible. Built for Shopify merchants who care about authenticity.</p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
            Questions? Contact us at support@verifymycollectible.com
          </p>
        </footer>
      </body>
    </html>
  );
}
