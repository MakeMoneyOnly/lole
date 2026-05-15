/**
 * API Documentation UI Route
 * Serves Swagger UI for interactive API documentation
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>lole Restaurant OS API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        body {
            margin: 0;
            background: #fafafa;
        }
        .swagger-ui .topbar {
            display: none;
        }
        .swagger-ui .info {
            margin: 30px 0;
        }
        .swagger-ui .info .title {
            font-size: 2.5em;
            font-weight: 700;
            color: #1a1a2e;
        }
        .swagger-ui .info .description {
            font-size: 1.1em;
            line-height: 1.6;
            color: #4a4a68;
        }
        .swagger-ui .info .description pre {
            background: #1a1a2e;
            color: #fff;
            padding: 12px;
            border-radius: 6px;
            font-size: 0.9em;
        }
        .swagger-ui .scheme-container {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-bottom: 20px;
        }
        .swagger-ui .opblock {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-bottom: 12px;
        }
        .swagger-ui .opblock .opblock-summary {
            border-radius: 8px 8px 0 0;
        }
        .swagger-ui .opblock.post .opblock-summary {
            background: #10b981;
            border-color: #10b981;
        }
        .swagger-ui .opblock.get .opblock-summary {
            background: #3b82f6;
            border-color: #3b82f6;
        }
        .swagger-ui .opblock.put .opblock-summary {
            background: #f59e0b;
            border-color: #f59e0b;
        }
        .swagger-ui .opblock.delete .opblock-summary {
            background: #ef4444;
            border-color: #ef4444;
        }
        .swagger-ui .opblock.patch .opblock-summary {
            background: #8b5cf6;
            border-color: #8b5cf6;
        }
        .lole-badge {
            display: inline-block;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
            margin-left: 12px;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: "/api/v1/internal/docs",
                dom_id: '#swagger-ui',
                deepLinking: true,
                showExtensions: true,
                showCommonExtensions: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout",
                plugins: [
                    function() {
                        return {
                            components: {
                                Topbar: function() { return null; }
                            }
                        };
                    }
                ],
                onComplete: function() {
                    // Add lole branding badge
                    var info = document.querySelector('.info .title');
                    if (info) {
                        var badge = document.createElement('span');
                        badge.className = 'lole-badge';
                        badge.textContent = 'Restaurant OS';
                        info.appendChild(badge);
                    }
                }
            });
        };
    </script>
</body>
</html>
    `;

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
}
