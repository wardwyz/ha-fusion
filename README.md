# Nova Domus

一个真正像家的 Home Assistant 面板。

Home Assistant 是最强大的智能家居平台之一，但它的界面往往不够精致。Nova Domus 是 Home Assistant 和你家中墙上的平板之间的那一层——快速、可配置、由每天使用它的人持续打磨。它始于 [ha-fusion](https://github.com/matt8707/ha-fusion) 的一个 fork，经过三年日常使用演变成了自己的项目。

[![preview](/static/preview.png)](https://youtu.be/2jNCyvkyLD8)

---

## 为什么选择 Nova Domus

**一个适配你家的面板，而不是让你去适配它。**
厨房的磁贴不一定要是一个灯开关。它可以是你家门外的摄像头、打开大门的按钮、以及告诉你是否在下雨的传感器——所有这些放在一个磁贴里，因为这才是你厨房里真正需要的东西。自定义面板让你自由组合：摄像头、按钮、传感器、滑条，全部整合在一个磁贴内，按照你真实的生活动线来布局。每个房间都不一样，面板应该反映出这种差异。

**最简单的界面，有时候就是没有界面。**
Nova Domus 内置了 AI 助手，连接到你在 Home Assistant 中已配置的任何智能体——Anthropic、Google、OpenAI、本地 Ollama 模型，HA 支持的都可以。直接问问题，得到答案或执行操作。语音输入和语音回复在浏览器支持的地方都可以用。无需额外配置：它通过 Home Assistant 的对话 API 路由，完全在 HA 对家居的了解范围内运作。

**专为无人值守运行而设计。**
在墙上面板上，面板应该大部分时间自己照顾自己。门铃响时，摄像头画面自动弹出，倒计时让你在模态框自动关闭前解锁门。当面板附近几分钟没人时，它会自动返回你设定的默认视图——户型图、客厅、或者任何适合作为待机状态的页面。无需点击，不会留下过期的屏幕。

---

## 安装

### Home Assistant 插件

如果你在使用 HA OS 或 Supervised，这是最简单的安装方式。添加仓库地址后直接从插件商店安装：

[![添加插件仓库](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Famedello%2Faddon-ha-fusion)

### Docker

```bash
docker run -d \
  --name nova-domus \
  -p 5050:5050 \
  -v /path/to/data:/app/data \
  -e TZ=Asia/Shanghai \
  -e HASS_URL=http://your-ha:8123 \
  ghcr.io/amedello/nova-domus
```

或者使用 Docker Compose：

```yaml
services:
  nova-domus:
    container_name: nova-domus
    image: ghcr.io/amedello/nova-domus
    volumes:
      - ./data:/app/data
    ports:
      - 5050:5050
    environment:
      TZ: Asia/Shanghai
      HASS_URL: http://your-ha:8123
    restart: always
```

### 开发环境

```bash
git clone https://github.com/wardwyz/ha-fusion.git
cd ha-fusion
pnpm install
echo 'HASS_URL=http://your-ha:8123' > .env
pnpm run dev
```

---

## 锁屏页面 `/screen`

新增的锁屏页面，专为墙上面板设计。访问 `http://your-ip:5050/screen` 即可使用。

### 功能

- **全屏图片轮播** — 从指定目录随机轮播图片，自动适应屏幕，不改变图片比例
- **实时歌词同步** — 播放音乐时，中央区域显示歌词（带时间戳的 LRC 格式），跟随播放进度自动滚动。支持 Music Assistant 播放器
- **公历 + 农历日期** — 日期下方显示农历月日、生肖年。自动检测中国传统节日（春节、元宵、端午、中秋等）
- **中文天气** — 天气状态显示中文
- **Home Assistant 通知** — 实时显示 HA 通知消息

### 环境变量配置

| 变量 | 说明 | 默认值 |
|---|---|---|
| `SCREEN_IMAGE_DIR` | 图片文件夹路径 | `/app/data/screen-images` |
| `SCREEN_IMAGE_EXTENSIONS` | 允许的图片扩展名 | `jpg,jpeg,png,webp` |
| `SCREEN_INTERVAL` | 轮播间隔（秒） | `30` |
| `SCREEN_LYRICS_API_URL` | 自定义歌词 API（可选），用 `{artist}` 和 `{title}` 做占位符 | 空，默认使用 api.lrc.cx |

### 歌词偏移设置

如果歌词与音乐不同步，可在 Nova Domus 设置页面中调节「歌词偏移」，范围 -10 ～ +10 秒，精度 0.5 秒。

---

## 鸣谢

本项目源于 [matt8707/ha-fusion](https://github.com/matt8707/ha-fusion) 的优秀工作，在此致以诚挚感谢。
