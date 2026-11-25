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

## 功能

- **可组合的房间面板** — 用自定义面板把摄像头、按钮、传感器和滑条组合在同一块磁贴中；还可配置条件显示、图片元素和不同尺寸的磁贴。
- **门铃弹窗** — 门铃触发时自动打开全屏画面；多个门铃依次处理，重要来访不会被普通弹窗覆盖。
- **AI 助手** — 连接 Home Assistant 对话智能体，支持文字和浏览器语音交互，并可配置语音回复。
- **用电摘要** — 按设备或领域统计正在运行的实体，并可从摘要中关闭设备。
- **Music Assistant** — 仪表盘磁贴显示当前曲目、封面和播放控制；锁屏播放时可显示 Party 页面。
- **MoviePilot** — 展示下载队列中的电影和剧集信息与海报。
- **待机自动返回** — 无人操作一段时间后，自动回到配置的默认视图。

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

专为墙上面板设计。访问 `http://your-ip:5050/screen` 即可使用。

### 功能

- **全屏图片轮播** — 从图片目录读取并随机排序，按设定间隔轮播
- **Music Assistant Party 页面** — Music Assistant 播放时显示 Party 页面，并指定当前选中的播放器；播放器继续播放时会保持显示该设备，停止后再切换到其他正在播放的设备
- **公历 + 农历日期** — 日期下方显示农历月日、生肖年。自动检测中国传统节日（春节、元宵、端午、中秋等）
- **天气与每日内容** — 显示 Home Assistant 天气实体、中文天气状态；可在设置中选择传感器，将其状态显示为中央内容
- **Home Assistant 通知** — 显示当前通知数量和最多两条通知预览
- **点击返回面板** — 点击屏幕进入主面板

### 环境变量配置

| 变量 | 说明 | 默认值 |
|---|---|---|
| `SCREEN_IMAGE_DIR` | 图片文件夹路径 | `./data/screen-images` |
| `SCREEN_IMAGE_EXTENSIONS` | 允许的图片扩展名 | `jpg,jpeg,png,webp,heic,heif` |
| `SCREEN_INTERVAL` | 轮播间隔（秒） | `30` |

图片目录支持子文件夹。Docker 部署时，可将主机图片目录挂载到容器的 `/app/data/screen-images`，或通过 `SCREEN_IMAGE_DIR` 指定其他容器内路径。

### Music Assistant 配置

在主面板的「设置 → 插件」中连接 Music Assistant，填写服务器地址、用户名和密码。连接后，Music Assistant 磁贴可选择要控制的播放器；锁屏页面会在播放时加载 Party 视图。请确保打开面板的浏览器可以访问 Music Assistant 服务器。

### 其他集成

- 在「设置 → 插件」中配置 MoviePilot 服务器地址和访问令牌，可选填 TMDB API Key 和镜像地址。
- 在「设置」中配置 Home Assistant 访问令牌及每日内容传感器。

---

## 鸣谢

本项目源于 [matt8707/ha-fusion](https://github.com/matt8707/ha-fusion) 的优秀工作，在此致以诚挚感谢。
