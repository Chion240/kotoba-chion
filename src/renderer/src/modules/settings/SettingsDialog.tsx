import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useSettings, setSetting } from './settings-store'
import { SliderRow, ColorRow, SwitchRow } from './SettingsControls'
import { useFonts } from './fonts'
import { FontTab } from './FontTab'
import { AppearancePresetPicker } from './AppearancePresetPicker'
import { ProfileTab } from './ProfileTab'
import { KeybindingTab } from './KeybindingTab'
import { TranslationTab } from '../ai-translation'
import { VoiceTab } from '../tts'
import {
  BookOpenText,
  Palette,
  Type,
  Sparkles,
  Volume2,
  Keyboard
} from 'lucide-react'
import {
  TOKEN_STYLES,
  type Mode,
  type Theme,
  type TokenStyle,
  type AppearancePreset
} from './settings-logic'
import './settings.css'

// 外观预设：一键 patch 明暗 + 三色槽（用户仍可在此之上微调单项）。
function applyPreset(preset: AppearancePreset): void {
  setSetting('theme', preset.patch.theme)
  setSetting('bgColor', preset.patch.bgColor)
  setSetting('bodyColor', preset.patch.bodyColor)
  setSetting('panelBgColor', preset.patch.panelBgColor)
}

const TOKEN_STYLE_LABELS: Record<TokenStyle, string> = {
  'capsule-soft': '轻柔胶囊',
  'capsule-clear': '清晰胶囊',
  'capsule-minimal': '近无框胶囊',
  marker: '柔和标记',
  underline: '极简下划线',
  classic: '经典方框'
}

function TokenStylePicker({ value }: { value: TokenStyle }): React.JSX.Element {
  return (
    <fieldset className="settings-token-style-field">
      <legend className="settings-label">词框样式</legend>
      <div className="settings-token-style-grid" role="radiogroup" aria-label="词框样式">
        {TOKEN_STYLES.map((style) => (
          <label
            key={style}
            className={
              style === value
                ? 'settings-token-option is-active'
                : 'settings-token-option'
            }
            data-token-style={style}
          >
            <input
              className="sr-only"
              type="radio"
              name="token-style"
              value={style}
              checked={style === value}
              onChange={() => setSetting('tokenStyle', style)}
            />
            <span className="settings-token-option-name">{TOKEN_STYLE_LABELS[style]}</span>
            <span className="settings-token-preview" aria-hidden="true">
              <span className="settings-token-sample">楽園</span>
              <span className="settings-token-sample">ノイズ</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SettingsSection({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-section-content">{children}</div>
    </section>
  )
}

// 统一设置面板：按用户任务组织为阅读、外观、字体、AI、声音、快捷键六组。
// 具体旋钮仍由 settings store 驱动，打开即生效，不需要额外保存按钮。
export function SettingsDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}): React.JSX.Element {
  const s = useSettings()
  const fonts = useFonts()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="settings-dialog"
        overlayClassName="bg-transparent backdrop-blur-none"
      >
        <DialogHeader className="settings-header">
          <DialogTitle className="settings-title">设置</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="reading" className="settings-tabs">
          <TabsList className="settings-tablist">
            <TabsTrigger value="reading"><BookOpenText />阅读</TabsTrigger>
            <TabsTrigger value="appearance"><Palette />外观</TabsTrigger>
            <TabsTrigger value="fonts"><Type />字体</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles />AI</TabsTrigger>
            <TabsTrigger value="voice"><Volume2 />声音</TabsTrigger>
            <TabsTrigger value="keys"><Keyboard />快捷键</TabsTrigger>
          </TabsList>

          <TabsContent value="reading" className="settings-pane">
                        <SettingsSection title="阅读方向" description="横排与竖排使用完全独立的排版参数，切换不会覆盖另一种布局。">
              <div className="settings-modes">
                <span className="settings-label">阅读方向</span>
                {(['horizontal', 'vertical'] as const).map((layout) => (
                  <button key={layout} className={s.layout === layout ? 'settings-seg is-active' : 'settings-seg'} onClick={() => setSetting('layout', layout)}>
                    {layout === 'horizontal' ? '横向阅读' : '竖向阅读'}
                  </button>
                ))}
              </div>
            </SettingsSection><SettingsSection title="阅读布局" description="控制正文在窗口中的密度和呼吸感。">
              <div className="settings-modes">
                <span className="settings-label">分词模式</span>
                {(['A', 'B', 'C'] as const).map((m) => (
                  <button
                    key={m}
                    className={m === s.mode ? 'settings-seg is-active' : 'settings-seg'}
                    onClick={() => setSetting('mode', m as Mode)}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <SliderRow knob="bodySize" label="正文字号" value={s.bodySize} suffix="rem" />
              <SliderRow knob="lineHeight" label="行距" value={s.lineHeight} />
              <SliderRow knob="leftMargin" label="左边距" value={s.leftMargin} step={1} suffix="%" />
              <SliderRow knob="rightMargin" label="右边距" value={s.rightMargin} step={1} suffix="%" />
              <SliderRow knob="segGap" label="段间距" value={s.segGap} suffix="rem" />
              <SliderRow knob="tocFontSize" label="目录字号" value={s.tocFontSize} suffix="rem" />              {s.layout === 'vertical' && (
                <>
                  <div className="settings-subheading">竖排专属参数</div>
                  <SliderRow knob="verticalBodySize" label="竖排字号" value={s.verticalBodySize} suffix="rem" />
                  <SliderRow knob="verticalLineHeight" label="竖排列高" value={s.verticalLineHeight} />
                  <SliderRow knob="verticalColumnGap" label="列间距" value={s.verticalColumnGap} suffix="rem" />
                  <SliderRow knob="verticalTokenGap" label="竖排词间距" value={s.verticalTokenGap} suffix="em" />
                  <SliderRow knob="verticalTokenLetterSpacing" label="竖排字距" value={s.verticalTokenLetterSpacing} suffix="em" />
                  <SliderRow knob="verticalTopMargin" label="上边距" value={s.verticalTopMargin} step={1} suffix="%" />
                  <SliderRow knob="verticalBottomMargin" label="下边距" value={s.verticalBottomMargin} step={1} suffix="%" />
                </>
              )}
            </SettingsSection>
            <SettingsSection title="文字层级" description="日文正文、标题和注音使用同一组排版控制。">
              <SliderRow knob="headingSize" label="标题字号" value={s.headingSize} suffix="rem" />
              <SliderRow knob="fontWeight" label="正文字重" value={s.fontWeight} step={50} />
              <SwitchRow boolKey="furigana" label="显示振假名" value={s.furigana} />
              <SliderRow knob="furiganaSize" label="假名大小" value={s.furiganaSize} suffix="em" />
              <SliderRow knob="furiganaOpacity" label="假名透明度" value={s.furiganaOpacity} />
              <ColorRow colorKey="furiganaColor" label="假名颜色" value={s.furiganaColor} />
            </SettingsSection>
            <SettingsSection title="译文显示" description="双语书的内置译文和纯日语书的 AI 译文都遵循这里的样式。">
              <SwitchRow boolKey="allZh" label="全书显示译文" value={s.allZh} />
              <SliderRow knob="zhSize" label="译文字号" value={s.zhSize} suffix="rem" />
              <SliderRow knob="zhWeight" label="译文字重" value={s.zhWeight} step={50} />
              <SliderRow knob="zhOpacity" label="译文透明度" value={s.zhOpacity} />
              <ColorRow colorKey="zhColor" label="译文颜色" value={s.zhColor} />
            </SettingsSection>
            <SettingsSection title="词框样式" description="调整分词标记的外观和相邻词的间距。">
              <TokenStylePicker value={s.tokenStyle} />
              <SliderRow knob="tokenGap" label="词间距" value={s.tokenGap} suffix="em" />
              <SliderRow knob="tokenLetterSpacing" label="词框内字距" value={s.tokenLetterSpacing} suffix="em" />
              <ColorRow colorKey="tokenBgColor" label="词框底色" value={s.tokenBgColor} />
              <SliderRow knob="tokenBgOpacity" label="词框透明度" value={s.tokenBgOpacity} />
            </SettingsSection>
          </TabsContent>

          <TabsContent value="appearance" className="settings-pane">
            <SettingsSection title="主题预设" description="选择即生效，只调整明暗和配色，不改变排版。">
              <AppearancePresetPicker settings={s} onSelect={applyPreset} />
            </SettingsSection>
            <SettingsSection title="颜色层级" description="阅读区、正文和侧边面板可以分别设置。">
              <div className="settings-modes">
                <span className="settings-label">明暗基底</span>
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  className={t === s.theme ? 'settings-seg is-active' : 'settings-seg'}
                  onClick={() => setSetting('theme', t as Theme)}
                >
                  {t === 'light' ? '亮' : '暗'}
                </button>
              ))}
              </div>
              <ColorRow colorKey="bgColor" label="阅读背景" value={s.bgColor} />
              <ColorRow colorKey="bodyColor" label="正文颜色" value={s.bodyColor} />
              <ColorRow colorKey="panelBgColor" label="面板背景" value={s.panelBgColor} />
            </SettingsSection>
          </TabsContent>

          <TabsContent value="fonts" className="settings-pane">
            <FontTab settings={s} fonts={fonts} />
          </TabsContent>

          <TabsContent value="ai" className="settings-pane">
            <SettingsSection title="AI 分析" description="用于选段解释、语法分析和对话。">
              <ProfileTab />
            </SettingsSection>
            <SettingsSection title="自动翻译" description="纯日语书按快捷键请求的译文连接。">
              <TranslationTab />
            </SettingsSection>
            <SettingsSection title="面板排版">
              <SliderRow knob="aiFontSize" label="AI 面板字号" value={s.aiFontSize} suffix="rem" />
            </SettingsSection>
          </TabsContent>

          <TabsContent value="voice" className="settings-pane">
            <VoiceTab />
          </TabsContent>

          <TabsContent value="keys" className="settings-pane">
            <KeybindingTab />
          </TabsContent>
        </Tabs>
        <div className="settings-footer">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
