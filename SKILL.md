---
name: fix-garden-location-poi
description: 使用 POI API 批量校准苏州园林数据。默认优先高德 WebService POI；当高德无高置信结果时，自动使用百度地点检索3.0（Place API v3）补查。同步更新 location.address、location.coordinates 与介绍文本地址。
---

# Fix Garden Location (Amap First, Baidu Fallback)

## Goal
修正园林数据中的位置信息，确保地址和坐标可用于导航且一致可信。

## Scope
- 数据文件：
  - `src/data/all_gardens.json`
  - `src/data/gardens.json`
  - `src/data/gardens2.json`
  - `src/data/gardens3.json`
  - `src/data/gardens4.json`
- 目标字段：
  - `location.address`
  - `location.coordinates`
  - `description`（当介绍文本包含地址时，同步更新）

## Required API
- 高德文本搜索：`https://restapi.amap.com/v3/place/text`
- 高德详情查询：`https://restapi.amap.com/v3/place/detail`
- 高德 Key（用户提供）：`7f5c47d71601047e7517e56f3eaeadc0`
- 百度地点检索3.0（行政区检索）：`https://api.map.baidu.com/place/v3/region`
- 百度地点详情检索：`https://api.map.baidu.com/place/v3/detail`
- 百度 Key（用户提供）：`XetsIepzo6tEu54t338nJixJsSvsd6ro`
- 百度文档：`https://lbsyun.baidu.com/faq/api?title=webapi/guide/webservice-placeapiV3/interfaceDocumentV3`

## Hard Rules
1. 只使用地图 POI API 可验证结果，不凭主观猜测写入。
2. 提供商顺序固定：先高德；仅当高德“无高置信候选/无结果/请求失败”时，才使用百度补查。
3. 禁止写入停车场、出入口、售票处、游客中心、地铁/公交站、路口等子设施点位。
4. `coordinates` 写入格式必须是 `lat,lng`。
5. 高德返回 `location=lng,lat`，写入前必须交换顺序。
6. 百度检索与详情请求必须带 `ret_coordtype=gcj02ll`，并使用返回的 `location.lat/location.lng` 直接写成 `lat,lng`。
7. 候选置信度不足时，不落盘，加入“待人工确认”列表。
8. 同一园林在所有数据文件中必须保持一致。
9. 除 `location.address` 外，介绍文本中的地址也必须同步更新，禁止出现新旧地址不一致。

## Why Coordinate Order Is Critical
项目导航代码按 `lat,lng` 读取：
- `services/navigation.ts` 中 `const [lat, lng] = garden.location.coordinates.split(',')`
因此如果误存为 `lng,lat`，导航会跳错位置。

## Query Strategy
默认城市限制：苏州 `adcode=320500`，`citylimit=true`。

### Step 1: Amap Text Search (Primary)
对每个园林发起：

```bash
curl -sG 'https://restapi.amap.com/v3/place/text' \
  --data-urlencode "key=7f5c47d71601047e7517e56f3eaeadc0" \
  --data-urlencode "keywords=<园林名>" \
  --data-urlencode "city=320500" \
  --data-urlencode "citylimit=true" \
  --data-urlencode "offset=10" \
  --data-urlencode "page=1" \
  --data-urlencode "extensions=all" \
  --data-urlencode "output=JSON"
```

若结果弱相关，再尝试一次关键词：`<园林名> 苏州`。

### Step 2: Candidate Selection
按以下顺序筛选（从高到低）：
1. 名称完全匹配（去空格、去括号后）
2. 名称高相似匹配（包含关系）
3. `adname/address` 与现有地址行政区匹配（如“姑苏区”）
4. `type/typecode` 与景点/园林/宗教场景相符
5. 名称或分类命中子设施关键词（停车场、出入口、售票等）直接剔除

选择最高分候选后，用其 `id` 进入高德详情查询。

### Step 3: Amap Detail Query

```bash
curl -sG 'https://restapi.amap.com/v3/place/detail' \
  --data-urlencode "key=7f5c47d71601047e7517e56f3eaeadc0" \
  --data-urlencode "id=<poi_id>" \
  --data-urlencode "extensions=all" \
  --data-urlencode "output=JSON"
```

从详情中提取：
- 地址：优先 `pname + cityname + adname + address`（去重拼接）
- 坐标：`location`（原始 `lng,lat`）

### Step 4: Baidu Fallback (Only If Amap Fails Confidence)
仅当高德没有高置信候选时执行：

```bash
curl -sG 'https://api.map.baidu.com/place/v3/region' \
  --data-urlencode "query=<园林名>" \
  --data-urlencode "region=苏州" \
  --data-urlencode "region_limit=true" \
  --data-urlencode "scope=2" \
  --data-urlencode "page_size=20" \
  --data-urlencode "page_num=0" \
  --data-urlencode "ret_coordtype=gcj02ll" \
  --data-urlencode "output=json" \
  --data-urlencode "ak=XetsIepzo6tEu54t338nJixJsSvsd6ro"
```

若弱相关，再试：`query=<园林名> 苏州`。

选中候选后，用 `uid` 拉详情：

```bash
curl -sG 'https://api.map.baidu.com/place/v3/detail' \
  --data-urlencode "uid=<uid>" \
  --data-urlencode "scope=2" \
  --data-urlencode "ret_coordtype=gcj02ll" \
  --data-urlencode "output=json" \
  --data-urlencode "ak=XetsIepzo6tEu54t338nJixJsSvsd6ro"
```

从百度结果提取：
- 地址：`province + city + area + address`（去重拼接）
- 坐标：`location.lat`、`location.lng`
- 注意：`navi_location` 常是出入口引导点，不作为园林主体坐标写入

## Writeback Format
1. 坐标统一写成 `lat,lng`，保留 6 位小数（必要时）
2. 高德坐标需交换：`lng,lat -> lat,lng`
3. 百度坐标直接写入：`lat,lng`
4. 同名或同 `id` 条目在所有目标 JSON 同步更新
5. 如果 `description` 含“位于<地址>”或等价地址描述，替换为新地址并保证语义通顺

## Validation (Must Pass)
1. 坐标可解析为两个数字
2. 纬度在 `[-90, 90]`，经度在 `[-180, 180]`
3. 第一个值应是纬度（苏州常见约 31.x），第二个值应是经度（约 120.x）
4. 不得出现子设施命中（停车场/出入口/售票等）
5. 运行构建验证：

```bash
npm run build
```

## Output Contract
每次执行后输出：
1. 已更新条目清单：`name | provider(amap/baidu) | old_address | new_address | old_coords | new_coords | poi_id_or_uid`
2. 待人工确认清单：`name | reason | top_candidates`
3. 修改的文件列表

## Notes
- 高级搜索分页总量上限 200 条，单页 `offset` 建议不超过 25。
- 使用 `adcode` 比 `citycode` 更精确，优先使用 `320500` 约束苏州范围。
- 百度地点检索3.0单次 `page_size` 最大 20，建议 `scope=2` 获取更完整字段。
