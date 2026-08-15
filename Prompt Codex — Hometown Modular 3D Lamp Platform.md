# MASTER PROMPT — XÂY DỰNG HỆ SINH THÁI HOMETOWN MODULAR 3D LAMP

Bạn là một Senior Software Architect + Full-stack Engineer + 3D Geometry Engineer + UI/UX Designer + Tauri/Rust Engineer.

Nhiệm vụ của bạn là xây dựng HOÀN CHỈNH một hệ sinh thái phần mềm và website thương mại cho thương hiệu đèn 3D FDM modular.

## QUY TẮC QUAN TRỌNG NHẤT

- KHÔNG được dừng giữa chừng để hỏi tôi có muốn tiếp tục hay không.
- KHÔNG được hỏi những câu hỏi không cần thiết.
- KHÔNG được chỉ tạo prototype rồi dừng.
- KHÔNG được để TODO quan trọng.
- KHÔNG được tạo mock functionality nếu có thể triển khai functionality thật.
- Khi gặp lỗi, hãy tự phân tích, sửa lỗi và tiếp tục.
- Nếu một thư viện/API không phù hợp, hãy tự chọn giải pháp tốt hơn.
- Nếu thiếu thông tin không quan trọng, hãy tự đưa ra quyết định hợp lý.
- Chỉ được yêu cầu tôi can thiệp khi thật sự không thể tiếp tục do thiếu credential, API key, domain, email server hoặc thông tin bí mật.
- Tất cả các phần có thể phát triển offline/local phải hoạt động được trước.
- Sau khi hoàn thành một module phải tự test module đó trước khi chuyển sang module tiếp theo.
- Cuối cùng phải chạy build/test toàn bộ project và tự sửa tất cả lỗi có thể sửa.

MỤC TIÊU CUỐI CÙNG:

Tạo một nền tảng có thể:

1. Tạo thiết kế đèn 3D bằng geometry.
2. Import kiểu dáng/shape vào hệ thống.
3. Chuyển shape đó thành lamp shade có cấu trúc phù hợp để in FDM.
4. Hỗ trợ chuẩn đuôi đèn E27.
5. Hỗ trợ Bambu Lab LED Kit 001.
6. Tạo các lamp module có thể tháo/lắp với một hệ thống Core/Base chung.
7. Preview sản phẩm 3D realtime.
8. Cho phép khách hàng xem, xoay, zoom và tùy chỉnh sản phẩm 3D trên website.
9. Chọn màu sản phẩm.
10. Đặt hàng.
11. Sau khi đặt hàng, khách nhập email.
12. Gửi email xác nhận đơn hàng cho khách.
13. Email khách nhận được phải có thông tin đơn hàng + thông tin liên hệ của shop để khách liên hệ.
14. Đồng thời gửi toàn bộ thông tin đơn hàng về email quản trị của tôi.
15. Có website thương mại.
16. Có desktop application cho Windows và macOS.
17. Desktop ưu tiên Tauri 2.
18. UI/UX phải cực kỳ hiện đại, premium, nhiều animation và mang phong cách Liquid Glass.
19. Architecture phải đủ tốt để tiếp tục mở rộng thành hàng chục/tới hơn 100 mẫu lamp shade.

---

# 1. Ý TƯỞNG SẢN PHẨM

Tên working project:

HOMETOWN MODULAR LAMP

Ý tưởng thương hiệu:

"Mỗi vùng đất — một ánh sáng."

Đây không phải một sản phẩm đèn duy nhất.

Đây là một hệ sinh thái:

CORE BASE
+
LAMP SHADE
+
PROVINCE/CITY COLLECTION

Ví dụ:

PHÚ YÊN COLLECTION:

- Gành Đá Đĩa Lamp
- Tháp Nghinh Phong Lamp
- Coastal Pattern Lamp
- Fishing Village Lamp
- Ocean Wave Lamp

ĐẮK LẮK COLLECTION:

- Highlands Lamp
- Coffee Pattern Lamp
- Traditional Pattern Lamp
- Long House Inspired Lamp
- Highlands Landscape Lamp

HUẾ COLLECTION:

- Imperial Architecture Lamp
- Royal Pattern Lamp
- Lotus Lamp
- Citadel Lamp

HÀ NỘI COLLECTION:

- Turtle Tower Lamp
- Temple of Literature Lamp
- Old Quarter Lamp
- Hanoi Pattern Lamp

TP.HCM COLLECTION:

- Skyline Lamp
- Landmark Architecture Lamp
- Urban Pattern Lamp

Architecture phải cho phép sau này dễ dàng thêm:

34 tỉnh/thành
x
3–10 mẫu mỗi tỉnh/thành

mà không phải sửa core architecture.

---

# 2. KIẾN TRÚC HỆ THỐNG

Thiết kế project theo monorepo.

Ưu tiên:

- pnpm
- TypeScript
- React
- Vite
- React Router 7
- Tailwind CSS
- shadcn/ui
- Lucide React
- Three.js
- React Three Fiber nếu phù hợp
- Drei
- Framer Motion hoặc Motion
- Tauri 2
- Rust
- Node.js backend
- PostgreSQL
- Prisma 7

Không dùng React Router 6.

Không downgrade Prisma nếu không cần thiết.

Nếu repo hiện tại đã có architecture, trước tiên kiểm tra codebase và giữ những phần tốt thay vì phá bỏ toàn bộ.

Kiến trúc mong muốn:

apps/
    web/
    desktop/

services/
    api/

packages/
    ui/
    geometry/
    lamp-engine/
    three-viewer/
    shared/
    types/
    config/

src-tauri/

hoặc architecture tương đương tốt hơn nếu repo hiện tại đã có cấu trúc phù hợp.

---

# 3. WEBSITE

Website phải là một storefront cao cấp cho sản phẩm 3D.

Các trang tối thiểu:

/

 /products

 /products/:slug

 /collections

 /collections/:slug

 /customize/:productId

 /cart

 /checkout

 /order/:id

 /about

 /contact

 /3d-showcase

 /admin

---

# 4. HOMEPAGE

Thiết kế theo phong cách premium technology + art + Vietnamese culture.

Hero section:

Một lamp 3D realtime ở giữa màn hình.

Có animation ánh sáng.

Có thể xoay lamp.

Background có glass layers.

Headline:

"BRING YOUR HOMETOWN TO LIGHT"

Subheadline:

"Những vùng đất bạn yêu quý, được tái hiện bằng ánh sáng."

CTA:

"KHÁM PHÁ COLLECTION"

và

"TẠO ĐÈN CỦA BẠN"

Không sử dụng giao diện thương mại điện tử thông thường.

Không làm UI kiểu template.

Phải có cảm giác:

Apple
+
Nothing
+
premium architecture
+
3D design software.

---

# 5. LIQUID GLASS UI

Toàn bộ UI phải theo phong cách Liquid Glass.

Đặc biệt chú ý:

- translucent surfaces
- backdrop blur
- glass cards
- subtle borders
- soft shadows
- layered depth
- glass navigation
- floating controls
- smooth gradients
- subtle reflections
- animated background
- hover states
- spring animation
- micro interactions
- smooth page transitions

Không lạm dụng glass tới mức khó đọc.

Typography phải rõ ràng.

UI phải responsive.

Desktop:

- widescreen layout
- large 3D viewport
- floating controls

Tablet:

- adaptive layout

Mobile:

- touch friendly
- bottom controls
- optimized 3D viewport

---

# 6. 3D PRODUCT VIEWER

Website phải có realtime 3D viewer.

Sử dụng:

Three.js
+
React Three Fiber
+
Drei

Tính năng:

- OrbitControls
- rotate
- zoom
- pan
- auto rotate
- camera presets
- front
- side
- back
- top
- bottom
- perspective
- orthographic

Có nút:

"ROTATE"

"RESET"

"FULLSCREEN"

"LIGHT ON/OFF"

---

# 7. REALISTIC LIGHTING

3D preview không được chỉ render một model xám.

Phải mô phỏng đèn.

Có:

- emissive material
- point light
- area light
- ambient light
- realistic shadow
- glow/bloom nếu phù hợp
- warm light
- neutral light
- cool light

Có slider:

Brightness

Color temperature

Có thể preview:

LIGHT OFF

LIGHT ON

---

# 8. COLOR CUSTOMIZATION

Người dùng có thể chọn màu lamp.

Ví dụ:

White
Black
Cream
Sand
Red
Blue
Green
Yellow
Pink
Custom

UI hiển thị swatches.

Khi đổi màu:

3D model phải cập nhật realtime.

Không reload page.

Cho phép product định nghĩa:

availableColors

defaultColor

priceByColor nếu cần.

---

# 9. CORE MODULAR SYSTEM

Thiết kế hệ thống:

CORE BASE
+
SHADE

Core Base chứa:

- LED module
- electrical housing
- connection
- locking mechanism
- optional controller

Shade có thể tháo ra.

Ví dụ:

CORE

↓

PHÚ YÊN / GÀNH ĐÁ ĐĨA

hoặc

PHÚ YÊN / THÁP NGHINH PHONG

hoặc

HUẾ / CỔNG HOÀNG THÀNH

Tất cả phải tương thích với Core.

---

# 10. QUICK LOCK SYSTEM

Thiết kế một chuẩn connection system.

Ưu tiên:

- twist lock
- bayonet lock
- snap-fit
- magnetic alignment nếu phù hợp

Không dùng nam châm nếu không cần thiết.

Connection phải:

- dễ in
- không cần support nếu có thể
- dễ lắp
- tháo được
- chịu được nhiệt độ đèn
- không quá mỏng
- có tolerance phù hợp FDM

Tạo geometry parameters:

wallThickness

clearance

snapDepth

lockAngle

lockWidth

connectionHeight

connectionDiameter

baseDiameter

shadeDiameter

---

# 11. E27 SUPPORT

Hệ thống phải hỗ trợ E27.

Không hard-code một kích thước duy nhất.

Tạo một mechanical specification/configuration:

E27_CONFIG

bao gồm:

- socket dimensions
- clearance
- wall thickness
- cable passage
- heat clearance
- mounting dimensions

Các thông số phải nằm trong configuration.

Không rải magic numbers trong geometry code.

Thiết kế socket adapter riêng:

E27Adapter

CoreBaseE27

E27ShadeInterface

---

# 12. BAMBU LAB LED KIT 001

Phải hỗ trợ Bambu Lab LED Kit 001.

Thiết kế:

LEDKit001Adapter

LEDKit001Core

LEDKit001Mount

Tất cả kích thước liên quan phải được tập trung trong:

hardware-specs/

hoặc:

packages/geometry/specs/

Không hard-code.

Trước khi implement geometry thực tế:

- kiểm tra thông số chính xác của sản phẩm
- ưu tiên nguồn chính thức
- ghi lại dimensions/reference
- tạo configuration rõ ràng

Nếu thông số chưa xác minh được, không được tự bịa.

Thiết kế adapter sao cho có thể thay đổi sau này.

---

# 13. LAMP GEOMETRY ENGINE

Đây là phần quan trọng nhất.

Tạo một Geometry Engine có khả năng tạo lamp shade từ shape.

Input:

ShapeDefinition

Ví dụ:

{
    type: "svg",
    path: "...",
    scale: 1,
    extrusion: 180,
    wallThickness: 1.6
}

hoặc:

{
    type: "landmark",
    geometry: ...
}

hoặc:

{
    type: "pattern",
    pattern: ...
}

Engine phải có khả năng:

1. Import SVG.
2. Import DXF nếu khả thi.
3. Import STL/OBJ/GLB để tham khảo.
4. Import custom geometry.
5. Convert 2D profile thành 3D.
6. Extrude.
7. Shell.
8. Hollow.
9. Add wall thickness.
10. Add light openings.
11. Add internal diffuser.
12. Add mounting system.
13. Add Core interface.
14. Validate geometry.
15. Export STL.
16. Export 3MF nếu phù hợp.
17. Preview realtime.

---

# 14. SHAPE TO LAMP ALGORITHM

Tạo pipeline:

INPUT SHAPE
↓
NORMALIZE
↓
CLEAN GEOMETRY
↓
SCALE
↓
OFFSET
↓
EXTRUDE
↓
HOLLOW
↓
WALL THICKNESS
↓
LIGHT PATTERN
↓
VENTILATION
↓
CORE CONNECTOR
↓
BASE INTERFACE
↓
FDM VALIDATION
↓
FINAL MESH
↓
PREVIEW
↓
EXPORT

Mỗi stage phải là module độc lập.

Ví dụ:

ShapeNormalizer

ShapeExtruder

ShellGenerator

WallGenerator

PatternGenerator

VentilationGenerator

MountGenerator

ConnectorGenerator

MeshValidator

STLExporter

---

# 15. LAMP SHAPE TYPES

Hệ thống phải hỗ trợ ít nhất:

A. Full 360° cylindrical lamp

B. Half-cylinder lamp

C. Organic freeform lamp

D. Landmark silhouette lamp

E. Pattern lamp

F. Vertical tower lamp

G. Geometric lamp

H. Multi-panel lamp

I. Stackable lamp

J. Modular lamp

---

# 16. LANDMARK MODE

Tạo một workflow:

IMPORT SHAPE

Người thiết kế upload:

SVG

hoặc

PNG

hoặc

DXF

Sau đó hệ thống giúp chuyển thành:

Lamp Shape.

Có controls:

Width

Height

Depth

Wall Thickness

Pattern Density

Opening Size

Bottom Thickness

Top Thickness

Light Diffusion

Mount Height

Connector Size

Ventilation

---

# 17. PATTERN ENGINE

Cho phép tạo pattern trên lamp.

Các pattern:

- Voronoi
- Hexagon
- Wave
- Grid
- Organic
- Lines
- Dots
- Custom SVG
- Custom image
- Custom geometry

Controls:

Density

Scale

Rotation

Spacing

Offset

Depth

Opening Size

Pattern Strength

---

# 18. FDM VALIDATION

Đây là sản phẩm dành cho in FDM nên phải có kiểm tra printability.

Kiểm tra:

- minimum wall thickness
- minimum feature size
- unsupported overhang
- bridge
- thin walls
- disconnected geometry
- non-manifold mesh
- self intersection
- small islands
- excessive detail
- connector tolerance

Hiển thị cảnh báo:

SAFE

WARNING

ERROR

Ví dụ:

"Wall thickness: 1.6 mm — SAFE"

"Minimum feature: 0.32 mm — WARNING"

"Overhang: 72° — SUPPORT RECOMMENDED"

---

# 19. Bambu A1 / 0.4MM NOZZLE PROFILE

Tạo preset:

BAMBU_A1_04

Thông số liên quan:

nozzleDiameter

minimumFeature

minimumWall

minimumGap

recommendedLayerHeight

recommendedOverhang

bridgeLimit

supportRecommendation

Các giá trị phải configurable.

Không hard-code vào UI.

---

# 20. 3D DESIGNER — DESKTOP APPLICATION

Desktop application dùng:

TAURI 2

Frontend:

React + TypeScript + Vite

Backend/core:

Rust

Desktop app dành cho designer/admin.

Layout:

LEFT SIDEBAR

- Projects
- Products
- Collections
- Geometry
- Hardware
- Materials
- Patterns
- Validation
- Export

CENTER

3D viewport

RIGHT SIDEBAR

Properties

Bottom:

Timeline / operations / validation

---

# 21. DESIGN WORKFLOW

Designer tạo project:

NEW LAMP

Sau đó:

1. Select Core.
2. Select hardware.
3. Import shape.
4. Scale shape.
5. Generate geometry.
6. Add pattern.
7. Add connector.
8. Validate.
9. Preview.
10. Assign product metadata.
11. Save.
12. Export STL/3MF.
13. Publish product.

---

# 22. NON-DESTRUCTIVE GEOMETRY

Không được phá hủy input shape.

Lưu:

OriginalShape

Parameters

GeneratedGeometry

Version

History

Điều này cho phép người dùng quay lại thay đổi:

Width

Height

Wall

Pattern

Connector

mà không cần import lại.

---

# 23. PROJECT FORMAT

Tạo format project riêng:

.hometownlamp

hoặc JSON project structure.

Ví dụ:

project.json

{
    "version": 1,
    "product": {},
    "shape": {},
    "geometry": {},
    "hardware": {},
    "pattern": {},
    "materials": {},
    "printProfile": {},
    "exports": {}
}

Có version migration.

---

# 24. PRODUCT DATABASE

Dùng PostgreSQL + Prisma 7.

Models tối thiểu:

User

Product

ProductVariant

Collection

Province

LampDesign

LampShade

LampBase

Hardware

Color

Material

Order

OrderItem

Customer

EmailLog

DesignProject

GeometryPreset

PrintProfile

ContactSettings

---

# 25. PRODUCT MODEL

Product phải hỗ trợ:

name

slug

description

collection

province

category

price

images

3dModel

availableColors

variants

hardwareCompatibility

featured

published

stockStatus

dimensions

weight

printTime

material

---

# 26. COLLECTION

Collection:

PHÚ YÊN

ĐẮK LẮK

HUẾ

HÀ NỘI

TP.HCM

etc.

Collection có:

cover image

3D hero model

description

story

products

---

# 27. PRODUCT DETAIL PAGE

Phải có:

3D viewer lớn.

Tên sản phẩm.

Collection.

Câu chuyện sản phẩm.

Giá.

Color selector.

Base selector.

Hardware selector.

Quantity.

Add to cart.

Order now.

Product specifications.

Dimensions.

Material.

Print technology.

Compatibility.

3D preview.

---

# 28. SHOPPING CART

Cart phải lưu:

Product

Variant

Color

Base

Quantity

Price

Total

---

# 29. CHECKOUT

Khi người dùng nhấn:

ĐẶT HÀNG

PHẢI hiển thị form:

Họ tên

Email

Số điện thoại

Địa chỉ

Ghi chú

Các sản phẩm đã chọn.

Tổng tiền.

Nút:

XÁC NHẬN ĐẶT HÀNG

Email là REQUIRED.

Không cho submit nếu email không hợp lệ.

---

# 30. ORDER FLOW

FLOW:

PRODUCT

↓

ADD TO CART

↓

CHECKOUT

↓

CUSTOMER INFORMATION

↓

EMAIL REQUIRED

↓

CREATE ORDER

↓

GENERATE ORDER NUMBER

↓

SEND CUSTOMER EMAIL

↓

SEND ADMIN EMAIL

↓

ORDER SUCCESS PAGE

---

# 31. CUSTOMER EMAIL

Sau khi đặt hàng thành công:

Gửi email đến email khách nhập.

Email phải có:

Tên khách

Mã đơn

Ngày đặt

Danh sách sản phẩm

Màu

Base

Quantity

Giá

Tổng tiền

Thông tin liên hệ của shop

Website

Email shop

Số điện thoại

Social/contact links nếu có

Nội dung:

"Cảm ơn bạn đã đặt hàng..."

---

# 32. ADMIN EMAIL

Đồng thời gửi email tới email quản trị.

Email phải có đầy đủ:

Order ID

Customer name

Customer email

Phone

Address

Products

Variants

Colors

Quantity

Total

Customer note

Timestamp

IP/order metadata nếu phù hợp về mặt privacy

---

# 33. EMAIL ARCHITECTURE

Không gửi email trực tiếp từ frontend.

Phải gửi từ backend.

Tạo EmailService.

Có interface:

EmailProvider

Có thể hỗ trợ:

SMTP

Resend

SendGrid

hoặc provider phù hợp.

Configuration qua ENV.

Không commit secret.

Tạo:

.env.example

Ví dụ:

DATABASE_URL=

SMTP_HOST=

SMTP_PORT=

SMTP_USER=

SMTP_PASSWORD=

SHOP_EMAIL=

SHOP_NAME=

SHOP_PHONE=

SHOP_WEBSITE=

---

# 34. ORDER SECURITY

Không tin dữ liệu giá từ frontend.

Backend phải tự lấy:

Product

Variant

Color

Price

và tính lại total.

Không cho client gửi total rồi backend tin tưởng.

Validate tất cả order data.

Rate limit checkout endpoint.

Validate email.

Validate quantity.

Validate product availability.

---

# 35. ADMIN PANEL

Admin phải có:

Dashboard

Orders

Products

Collections

Provinces

Colors

Hardware

Lamp Designs

Geometry Projects

Customers

Email Logs

Settings

---

# 36. ADMIN ORDER DETAIL

Admin có thể:

view order

change status

mark processing

mark completed

cancel

add note

view customer

resend email

---

# 37. ORDER STATUS

PENDING

CONFIRMED

PROCESSING

PRINTING

QUALITY_CHECK

PACKING

SHIPPED

COMPLETED

CANCELLED

---

# 38. 3D PRODUCT STORAGE

Thiết kế architecture để lưu:

GLB

GLTF

STL

3MF

Preview images

Thumbnails

Không tải STL khổng lồ trực tiếp trong product viewer nếu GLB nhẹ hơn.

Pipeline:

STL/3MF

↓

Generate Preview

↓

GLB

↓

Web Viewer

---

# 39. DESKTOP EXPORT

Desktop app phải hỗ trợ:

Export STL

Export 3MF

Export GLB

Export project

Export preview image

Export technical dimensions

---

# 40. GEOMETRY ENGINE

Nếu geometry engine cần boolean operations:

Ưu tiên sử dụng giải pháp robust.

Có thể dùng:

Rust geometry libraries

hoặc

OpenCascade / WASM / suitable solid modeling engine

nhưng phải ưu tiên:

- stability
- precision
- performance
- maintainability

Không tự viết boolean engine nếu thư viện tốt hơn tồn tại.

---

# 41. PERFORMANCE

3D viewer phải tối ưu.

Yêu cầu:

- lazy loading
- Draco compression nếu phù hợp
- GLB
- texture optimization
- instancing
- LOD
- debounce geometry controls
- worker threads khi phù hợp

Không để UI freeze khi generate geometry.

---

# 42. WEB / DESKTOP SHARED ENGINE

Càng nhiều logic càng tốt phải dùng chung.

Ví dụ:

packages/geometry

packages/lamp-engine

packages/types

packages/shared

Desktop và Web không được duplicate logic nếu không cần.

Rust chỉ xử lý phần native/heavy computation khi phù hợp.

---

# 43. TAURI

Tauri 2 phải được sử dụng cho desktop.

Windows:

Windows 10/11 nếu phù hợp.

macOS:

Intel + Apple Silicon nếu architecture cho phép.

Tauri commands phải rõ ràng.

Không đưa secret backend vào desktop app.

---

# 44. BACKEND

Backend:

Node.js

TypeScript

NestJS hoặc Fastify/Express nếu architecture hiện tại phù hợp.

Nếu dùng NestJS:

Modules:

ProductsModule

CollectionsModule

OrdersModule

CustomersModule

EmailModule

AdminModule

GeometryModule

FilesModule

---

# 45. API

REST hoặc tRPC.

Endpoints tối thiểu:

GET /products

GET /products/:slug

GET /collections

GET /collections/:slug

GET /colors

POST /orders

GET /orders/:id

POST /admin/orders/:id/resend-email

POST /admin/products

PUT /admin/products/:id

DELETE /admin/products/:id

---

# 46. SEO

Website phải SEO-friendly.

Implement:

- metadata
- Open Graph
- Twitter cards
- canonical
- structured data
- product schema
- breadcrumb
- collection schema
- sitemap
- robots.txt

URL đẹp:

/products/phu-yen/ganh-da-dia

/collections/phu-yen

---

# 47. VIETNAMESE LANGUAGE

UI mặc định:

TIẾNG VIỆT

Có architecture để thêm English.

Không hard-code toàn bộ text trong component.

Dùng i18n.

---

# 48. MOBILE

Mobile phải usable.

Product page:

3D viewer full width.

Bottom sticky:

GIÁ

MÀU

THÊM VÀO GIỎ

MUA NGAY

Animations phải nhẹ hơn mobile nếu cần để đảm bảo performance.

---

# 49. ANIMATION SYSTEM

Animation phải nhất quán.

Dùng:

Framer Motion / Motion.

Implement:

- page transitions
- modal transitions
- hover
- button press
- product card entrance
- 3D viewer entrance
- collection transitions
- cart animation
- checkout animation
- order success animation
- glass blur transitions
- scroll reveal

Không animation vô nghĩa.

Animation phải phục vụ UX.

---

# 50. PRODUCT CARD

Product card không chỉ là ảnh.

Mỗi card có:

3D preview

collection

province

product name

price

available colors

"VIEW 3D"

Hover:

model quay nhẹ.

Lighting thay đổi.

Glass overlay xuất hiện.

---

# 51. 3D PRODUCT CUSTOMIZER

Trang:

/customize/:productId

Layout:

LEFT:

3D preview

RIGHT:

Customization panel

Options:

Color

Base

Light

Size

Hardware

Pattern nếu sản phẩm cho phép.

Price cập nhật realtime.

---

# 52. 3D DESIGN ADMIN VIEWER

Admin phải có chế độ:

Engineering View

Consumer View

Engineering View hiển thị:

- bounding box
- dimensions
- wall thickness
- connector
- center
- origin
- axis
- measurements

Consumer View:

Không có technical overlays.

---

# 53. MEASUREMENT TOOL

3D designer phải có:

Measure distance

Measure height

Measure width

Measure angle

Bounding box

---

# 54. GEOMETRY PREVIEW

Trong lúc chỉnh:

Width
Height
Thickness
Pattern

3D preview cập nhật.

Nếu geometry generation nặng:

dùng preview mesh trước.

Sau khi user bấm:

GENERATE FINAL

thì tạo high quality mesh.

---

# 55. PRINTABILITY REPORT

Sau khi generate:

PRINTABILITY REPORT

Ví dụ:

Overall: SAFE

Wall thickness: SAFE

Overhang: WARNING

Small details: SAFE

Connector: SAFE

Non-manifold: SAFE

Estimated print time: 5h 42m

Estimated material: 82g

---

# 56. MATERIAL

Hệ thống phải hỗ trợ:

PLA

PETG

PETG-CF nếu cần

Không hard-code material.

Material config:

temperature

cooling

layerHeight

minWall

maxOverhang

---

# 57. PRODUCT INFORMATION

Mỗi product có:

Print material

Estimated print time

Estimated material usage

Recommended nozzle

Recommended layer height

Support requirement

Hardware compatibility

---

# 58. 3D MODEL VERSIONING

Mỗi sản phẩm có:

v1

v1.1

v2

v2.1

Không overwrite destructive.

Admin có thể publish version.

---

# 59. FILE SYSTEM

Tạo storage abstraction.

Không hard-code local filesystem vào business logic.

Có thể hỗ trợ:

Local

S3 compatible

Cloudflare R2

---

# 60. TESTING

Bắt buộc viết tests.

Unit tests:

Geometry

Pricing

Order

Email

Validation

Product

Integration:

API

Database

Checkout

Email

E2E:

Browse product

Customize

Add cart

Checkout

Order creation

Success page

Admin order

---

# 61. GEOMETRY TESTS

Test các trường hợp:

- simple rectangle
- circle
- SVG
- complex SVG
- thin shape
- self intersect
- empty shape
- invalid geometry
- huge shape
- tiny shape

---

# 62. ORDER TEST

Test:

valid order

invalid email

missing email

empty cart

invalid product

invalid price

quantity 0

quantity negative

product unavailable

duplicate order request

---

# 63. EMAIL TEST

Development mode:

Không gửi email thật.

Có:

Mailhog/Mailpit hoặc mock provider.

Production:

SMTP/provider thật.

---

# 64. ERROR HANDLING

Không để:

console.error בלבד.

Phải có user-friendly error UI.

Ví dụ:

"Không thể tạo mô hình."

"Không thể kết nối máy chủ."

"Đơn hàng chưa được tạo."

"Email không hợp lệ."

---

# 65. LOGGING

Backend logging.

Geometry errors.

Order errors.

Email errors.

Admin actions.

Không log:

password

SMTP password

API key

payment secret

---

# 66. SECURITY

Implement:

CORS

CSRF nếu architecture cần

rate limit

input validation

SQL injection protection

XSS protection

secure headers

authentication

authorization

admin role

secret management

---

# 67. PAYMENT

Ở phiên bản đầu:

KHÔNG bắt buộc payment gateway.

Cho phép:

ORDER REQUEST

Sau khi đặt hàng:

Shop liên hệ khách để xác nhận thanh toán.

Architecture phải đủ tốt để sau này thêm:

VNPay

MoMo

ZaloPay

Stripe

---

# 68. CONTACT INFORMATION

Admin Settings phải cho phép nhập:

Shop name

Owner name

Email

Phone

Facebook

Zalo

Website

Address

Social links

Thông tin này được sử dụng tự động trong:

customer email

contact page

footer

order confirmation

---

# 69. ADMIN SETTINGS

Không hard-code contact information.

Admin có thể thay đổi:

shopName

shopEmail

shopPhone

shopAddress

facebook

zalo

website

---

# 70. PRODUCT DATA SEED

Tạo seed data.

Ít nhất:

PHÚ YÊN COLLECTION

3 sản phẩm mẫu:

PY01 Gành Đá Đĩa

PY02 Tháp Nghinh Phong

PY03 Coastal Pattern

Đồng thời tạo sample:

Hà Nội

TP.HCM

Đắk Lắk

Huế

Không cần geometry cuối cùng phải hoàn hảo cho tất cả sample ngay từ đầu, nhưng architecture phải hỗ trợ.

---

# 71. DEMO MODE

Nếu backend chưa có production data:

Website vẫn phải hiển thị demo products.

Nhưng demo data phải có architecture rõ ràng để thay bằng database thật.

---

# 72. DESIGN LANGUAGE

Design phải tạo cảm giác:

Premium

Modern

Technical

Cultural

Minimal

Futuristic

Không sử dụng:

- gradient quá rẻ tiền
- quá nhiều màu
- card bo góc vô lý
- text quá nhỏ
- animation gây khó chịu

---

# 73. COLOR SYSTEM

Primary:

black / white / translucent glass

Accent:

warm amber / warm light

Product colors:

dynamic.

Không hard-code màu sản phẩm vào UI component.

---

# 74. DARK MODE

Default:

Dark premium.

Có Light mode.

Theme switch animation.

---

# 75. ACCESSIBILITY

Implement:

- keyboard navigation
- focus states
- aria labels
- sufficient contrast
- reduced motion
- screen reader friendly controls

---

# 76. RESPONSIVE 3D

Desktop:

large viewport.

Mobile:

lower-poly model.

Tự động giảm:

shadows

post-processing

geometry quality

nếu thiết bị yếu.

---

# 77. OFFLINE DESKTOP

Desktop app phải có thể:

- mở project local
- xem geometry
- chỉnh geometry
- generate
- export STL
- export 3MF

mà không cần internet.

Các chức năng cần server:

- product publishing
- order
- email
- cloud sync

phải hiển thị trạng thái rõ ràng.

---

# 78. PROJECT AUTOSAVE

Designer app phải autosave.

Có:

Ctrl/Cmd + S

Auto save.

Recovery.

Recent Projects.

---

# 79. UNDO / REDO

Geometry designer:

Ctrl/Cmd + Z

Ctrl/Cmd + Shift + Z

History stack.

---

# 80. PERFORMANCE TARGET

Mục tiêu:

UI 60 FPS trong thao tác thông thường.

3D viewer mượt.

Không block main thread khi geometry generation nặng.

Dùng Web Worker hoặc Rust command nếu phù hợp.

---

# 81. DOCUMENTATION

Tạo:

README.md

ARCHITECTURE.md

GEOMETRY_ENGINE.md

3D_FORMAT.md

HARDWARE.md

EMAIL.md

DATABASE.md

DEPLOYMENT.md

DESKTOP.md

DEVELOPMENT.md

---

# 82. ENVIRONMENT

Tạo:

.env.example

.env.development.example

.env.production.example

Không commit:

.env

secrets

API keys

SMTP credentials

---

# 83. DEVELOPMENT COMMANDS

Phải có các command rõ ràng:

pnpm install

pnpm dev

pnpm dev:web

pnpm dev:api

pnpm dev:desktop

pnpm build

pnpm test

pnpm lint

pnpm typecheck

pnpm db:migrate

pnpm db:seed

pnpm tauri:build

Tên command có thể điều chỉnh theo architecture thực tế.

---

# 84. CI/CD

Nếu repo có GitHub:

Tạo GitHub Actions:

- install
- lint
- typecheck
- test
- build web
- build backend

Desktop build:

Windows

macOS

nếu environment cho phép.

---

# 85. DATABASE MIGRATION

Prisma 7.

Schema phải có relations rõ ràng.

Không dùng deprecated Prisma configuration.

Nếu Prisma 7 yêu cầu prisma.config.ts thì sử dụng đúng architecture của Prisma 7.

---

# 86. ADMIN AUTH

Admin authentication.

Không để:

/admin

public.

Role:

ADMIN

CUSTOMER

---

# 87. IMAGE / 3D ASSETS

Product phải có:

heroImage

gallery

model3D

thumbnail

technicalImage

Không lưu binary lớn trực tiếp vào database.

Database chỉ lưu asset URLs/references.

---

# 88. PRODUCT MODEL FORMAT

Khuyến nghị:

GLB cho Web.

STL/3MF cho manufacturing.

SVG/DXF cho source geometry.

Project JSON cho source parameters.

---

# 89. GEOMETRY ENGINE API

Thiết kế API kiểu:

generateLamp(config)

generateShade(config)

generateConnector(config)

generatePattern(config)

validateMesh(mesh)

estimatePrintability(mesh, profile)

exportSTL(mesh)

export3MF(mesh)

exportGLB(mesh)

---

# 90. DESIGN CONFIG

Ví dụ:

{
  "shape": {
    "source": "svg",
    "width": 180,
    "height": 220
  },
  "shell": {
    "wallThickness": 1.6
  },
  "pattern": {
    "type": "custom",
    "density": 0.7
  },
  "hardware": {
    "type": "BAMBU_LED_KIT_001"
  },
  "connector": {
    "type": "CORE_BAYONET"
  },
  "printProfile": {
    "printer": "BAMBU_A1",
    "nozzle": 0.4
  }
}

---

# 91. EXTENSIBILITY

Architecture phải cho phép thêm hardware:

E27

BAMBU_LED_KIT_001

Future LED modules

Future socket systems

Không sửa core geometry engine khi thêm hardware mới.

---

# 92. PRODUCT GENERATOR

Tạo một Product Generator UI:

SELECT:

Province

Collection

Design Type

Shape

Hardware

Base

Pattern

Material

Color

Size

Sau đó:

GENERATE PRODUCT

---

# 93. AUTOMATIC PRODUCT PREVIEW

Sau khi generate:

Tự tạo:

hero render

front render

side render

back render

light-on render

light-off render

thumbnail

---

# 94. TECHNICAL DRAWING

Có thể generate technical preview:

Width

Height

Diameter

Connector

E27

LED Kit

---

# 95. CUSTOMER 3D EXPERIENCE

Người dùng phải có cảm giác:

"Đây là một sản phẩm thật."

Không phải:

"Đây là một file STL."

---

# 96. NO GENERIC TEMPLATE DESIGN

Không dùng template dashboard mặc định.

Không dùng generic ecommerce theme.

Tự thiết kế design system.

Tạo reusable components:

GlassCard

GlassButton

GlassNavbar

FloatingPanel

Product3DViewer

ColorPicker

CollectionCard

ProductCard

OrderSummary

GeometryControl

PropertyPanel

MeasurementOverlay

ValidationBadge

---

# 97. MICRO INTERACTION

Ví dụ:

Khi hover product:

3D model rotate nhẹ.

Khi click:

camera zoom.

Khi đổi màu:

transition material.

Khi bật đèn:

light fade in.

Khi add cart:

product miniature bay vào cart.

Khi checkout:

smooth transition.

Khi order thành công:

animated confirmation.

---

# 98. BRAND EXPERIENCE

Website phải kể câu chuyện:

"Quê hương không chỉ là nơi bạn sinh ra."

"Đó là nơi bạn nhớ."

"Và chúng tôi biến những ký ức ấy thành ánh sáng."

Đừng biến website thành catalogue khô cứng.

---

# 99. IMPORTANT — PROVINCE/CITY DATA

Do hệ thống hành chính Việt Nam đã thay đổi, không hard-code giả định cũ.

Province model phải hỗ trợ:

current administrative identity

historical identity

aliases

formerProvince

mergedFrom

effectiveDate

collectionVersion

Điều này cho phép sau này có:

"Phú Yên — Heritage Collection"

và

"Đắk Lắk — Current Collection"

mà không phá database.

---

# 100. FIRST MVP

MVP phải hoàn chỉnh các phần sau:

CORE BASE

E27

BAMBU LED KIT 001

3D viewer

Color selector

3D product page

Phú Yên Collection

PY01 Gành Đá Đĩa

PY02 Tháp Nghinh Phong

PY03 Coastal Pattern

Cart

Checkout

Email customer

Email admin

Admin orders

Tauri desktop

Geometry generator

STL export

GLB export

FDM validation

---

# 101. PRIORITY

Ưu tiên theo thứ tự:

P0 — Architecture

P0 — 3D engine

P0 — Core/Hardware geometry

P0 — Product viewer

P0 — Product system

P0 — Cart/order/email

P0 — Tauri

P1 — Admin

P1 — Geometry designer

P1 — Advanced patterns

P1 — Printability analysis

P2 — Advanced rendering

P2 — Future payment

P2 — Cloud sync

---

# 102. CODING STANDARD

Code phải:

- strongly typed
- modular
- documented
- testable
- maintainable
- no unnecessary duplication
- no magic numbers
- no giant components
- no giant functions
- no hidden state
- no unsafe any nếu tránh được

---

# 103. BEFORE CODING

Đầu tiên:

1. Inspect toàn bộ repository.
2. Inspect package.json.
3. Inspect pnpm workspace.
4. Inspect existing Tauri setup.
5. Inspect existing frontend.
6. Inspect existing backend.
7. Inspect Prisma.
8. Inspect Rust.
9. Inspect existing geometry/WASM code nếu có.
10. Xác định cái gì có thể reuse.
11. Xác định architecture gaps.
12. Tạo implementation plan.

NHƯNG:

Sau khi phân tích xong KHÔNG ĐƯỢC DỪNG ĐỂ HỎI TÔI.

Tự tiếp tục implement.

---

# 104. IMPLEMENTATION LOOP

Thực hiện vòng lặp:

ANALYZE

↓

IMPLEMENT

↓

RUN

↓

TEST

↓

FIND ERROR

↓

FIX

↓

TEST AGAIN

↓

REFACTOR

↓

CONTINUE

Không được dừng chỉ vì gặp error.

---

# 105. BUILD GATE

Trước khi nói "hoàn thành":

Phải chạy:

- install
- lint
- typecheck
- unit tests
- integration tests
- frontend build
- backend build
- Tauri build nếu environment hỗ trợ

Nếu lỗi:

TỰ SỬA.

Sau đó chạy lại.

---

# 106. FINAL REPORT

Chỉ sau khi hoàn thành toàn bộ project mới báo cáo.

Báo cáo:

1. Architecture
2. Các module đã hoàn thành
3. Geometry engine
4. Hardware support
5. Web
6. Desktop
7. Database
8. Order system
9. Email
10. Admin
11. Tests
12. Build status
13. Các file quan trọng
14. Các command chạy project
15. Các ENV cần cấu hình
16. Những phần chưa thể tự động do cần credential bên ngoài

Nếu một phần chưa hoàn thành vì phụ thuộc credential:

Không được giả vờ đã hoàn thành.

Ghi rõ:

BLOCKED BY EXTERNAL CREDENTIAL

và tiếp tục hoàn thành mọi phần còn lại.

---

# 107. ABSOLUTE RULE

ĐÂY LÀ MỘT YÊU CẦU HOÀN THÀNH DỰ ÁN.

Không phải yêu cầu tạo prototype.

Không phải yêu cầu tạo demo.

Không phải yêu cầu viết skeleton.

Hãy xây dựng production-ready foundation.

Không được kết thúc sau khi tạo vài component.

Không được hỏi:

"Bạn có muốn tôi tiếp tục không?"

Không được hỏi:

"Bạn muốn tôi làm phần nào tiếp theo?"

Không được dừng vì task lớn.

Hãy tự chia nhỏ task và hoàn thành tuần tự cho đến khi đạt mục tiêu.

Nếu cần quyết định giữa nhiều giải pháp:

- chọn giải pháp ổn định hơn
- chọn giải pháp dễ maintain hơn
- chọn giải pháp phù hợp Tauri 2
- chọn giải pháp phù hợp FDM/3D geometry
- chọn giải pháp performance tốt
- ghi quyết định vào ARCHITECTURE.md

---

# 108. ĐỊNH NGHĨA "DONE"

Project chỉ được coi là DONE khi:

[ ] Web chạy được.

[ ] Tauri desktop chạy được.

[ ] Windows target được cấu hình.

[ ] macOS target được cấu hình.

[ ] Product catalog hoạt động.

[ ] Collection hoạt động.

[ ] 3D viewer hoạt động.

[ ] Color selection hoạt động.

[ ] Product customization hoạt động.

[ ] Cart hoạt động.

[ ] Checkout hoạt động.

[ ] Email khách hoạt động qua configured provider.

[ ] Email admin hoạt động.

[ ] Order được lưu database.

[ ] Admin xem được order.

[ ] E27 geometry được hỗ trợ.

[ ] Bambu LED Kit 001 geometry được hỗ trợ.

[ ] Core modular system hoạt động.

[ ] Shape import hoạt động.

[ ] Geometry generation hoạt động.

[ ] Lamp shell generation hoạt động.

[ ] Pattern generation hoạt động.

[ ] Connector generation hoạt động.

[ ] FDM validation hoạt động.

[ ] STL export hoạt động.

[ ] 3MF export được hỗ trợ nếu khả thi.

[ ] GLB preview hoạt động.

[ ] Undo/redo hoạt động.

[ ] Autosave hoạt động.

[ ] Tests hoạt động.

[ ] Build hoạt động.

[ ] Documentation hoàn thành.

[ ] Không còn lỗi TypeScript.

[ ] Không còn lỗi Rust.

[ ] Không còn lỗi build.

[ ] Không còn TODO quan trọng.

---

# FINAL INSTRUCTION TO CODEX

BẮT ĐẦU NGAY.

Hãy kiểm tra repository hiện tại trước.

Sau đó tự xây dựng toàn bộ hệ thống.

Không chờ tôi xác nhận từng bước.

Không dừng để hỏi tiếp tục.

Tự giải quyết vấn đề.

Tự test.

Tự sửa lỗi.

Tự refactor.

Tự hoàn thiện.

Chỉ kết thúc khi project đạt định nghĩa DONE ở trên.