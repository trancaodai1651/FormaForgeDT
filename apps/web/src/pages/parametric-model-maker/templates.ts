import { DEFAULT_WAVY, SAMPLE_SCAD, type MakerProject } from "./model";
export const TEMPLATES = [
  {
    id: "wavy",
    name: "Chữ tròn lượn sóng",
    category: "Chữ và trang trí",
    description:
      "Chữ lượn sóng, bo góc mượt, hai vùng màu và móc khóa tùy chỉnh.",
    kind: "wavy" as const,
    icon: "Aa",
    source: "",
  },
  {
    id: "starter",
    name: "Khối tham số",
    category: "Cơ bản",
    description: "Trụ hoặc hộp có lỗ, màu sắc và kích thước tùy chỉnh.",
    kind: "scad" as const,
    icon: "◉",
    source: SAMPLE_SCAD,
  },
  {
    id: "vase",
    name: "Ống đựng bút xoắn",
    category: "Đồ dùng",
    description: "Số cạnh, góc xoắn, độ cao và độ dày thành.",
    kind: "scad" as const,
    icon: "▥",
    source: `/* [Kích thước] */
diameter = 40; // [20:1:100]
height = 65; // [20:1:150]
wall = 2; // [1:0.2:5]
/* [Kiểu dáng] */
sides = 8; // [4:1:24]
twist = 30; // [-90:5:90]
model_color = "#32a45b"; // color
/* [Hidden] */
color(model_color) difference() {
  linear_extrude(height=height,twist=twist,slices=80) circle(d=diameter,$fn=sides);
  translate([0,0,wall]) linear_extrude(height=height,twist=twist,slices=80) circle(d=diameter-2*wall,$fn=sides);
}`,
  },
  {
    id: "tag",
    name: "Thẻ tên",
    category: "Chữ và trang trí",
    description: "Chữ nổi, lỗ treo và nền bo tròn; soạn trực tiếp bằng SCAD.",
    kind: "scad" as const,
    icon: "Ab",
    source: `/* [Nội dung] */
name = "HELLO";
text_font = "Lilita One"; // font
/* [Kích thước] */
width = 65; // [35:1:120]
height = 24; // [15:1:50]
depth = 2; // [1:0.2:6]
text_size = 12; // [5:0.5:25]
text_depth = 1; // [0.4:0.2:3]
/* [Màu sắc] */
base_color = "#356cd1"; // color
letter_color = "#ffffff"; // color
/* [Hidden] */
$fn=64;
color(base_color) linear_extrude(depth) difference(){
  hull() for(x=[-width/2+4,width/2-4],y=[-height/2+4,height/2-4]) translate([x,y]) circle(r=4);
  translate([-width/2+6,0]) circle(d=4);
}
color(letter_color) translate([4,0,depth]) linear_extrude(text_depth) text(name,size=text_size,font=text_font,halign="center",valign="center");`,
  },
  {
    id: "blank",
    name: "SCAD trống",
    category: "Cơ bản",
    description: "Bắt đầu từ code của bạn, hỗ trợ file và thư viện bổ sung.",
    kind: "scad" as const,
    icon: "</>",
    source:
      "// Viết OpenSCAD, sau đó nhấn Dựng mô hình hoặc Ctrl+Enter.\nsize = 20; // [1:1:100]\ncube([size,size,size],center=true);\n",
  },
];
export function createProject(template = TEMPLATES[0]): MakerProject {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: template.name,
    kind: template.kind,
    config: { ...DEFAULT_WAVY },
    source: template.source,
    values: {},
    updated: Date.now(),
    favorite: false,
  };
}
