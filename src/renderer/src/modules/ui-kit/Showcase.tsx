import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog'

const JP_SAMPLE =
  '吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。'

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-5 text-card-foreground">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function Showcase(): React.JSX.Element {
  const [dark, setDark] = useState(false)
  const [fontSize, setFontSize] = useState([20])

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Chion RUAD · UI Kit</h1>
              <p className="text-sm text-muted-foreground">设计 token + shadcn 原语自测页</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              暗色
              <Switch checked={dark} onCheckedChange={setDark} />
            </label>
          </header>

          <Section title="Button · 变体">
            <div className="flex flex-wrap gap-2">
              <Button>默认</Button>
              <Button variant="secondary">次级</Button>
              <Button variant="outline">描边</Button>
              <Button variant="ghost">幽灵</Button>
              <Button variant="link">链接</Button>
              <Button variant="destructive">危险</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">小</Button>
              <Button size="default">中</Button>
              <Button size="lg">大</Button>
              <Button disabled>禁用</Button>
            </div>
          </Section>

          <Section title="Tabs · 标签页">
            <Tabs defaultValue="a">
              <TabsList>
                <TabsTrigger value="a">分词 A</TabsTrigger>
                <TabsTrigger value="b">分词 B</TabsTrigger>
                <TabsTrigger value="c">分词 C</TabsTrigger>
              </TabsList>
              <TabsContent value="a" className="text-sm text-muted-foreground">
                A 模式：最短单位切分。
              </TabsContent>
              <TabsContent value="b" className="text-sm text-muted-foreground">
                B 模式：中等粒度。
              </TabsContent>
              <TabsContent value="c" className="text-sm text-muted-foreground">
                C 模式：命名实体粒度。
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Switch · Slider · 控件">
            <div className="flex items-center gap-3 text-sm">
              <Switch defaultChecked id="s1" />
              <label htmlFor="s1">全书中文显示</label>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">
                字号：{fontSize[0]}px
              </span>
              <Slider value={fontSize} onValueChange={setFontSize} min={12} max={40} step={1} />
            </div>
          </Section>

          <Section title="Dialog · 对话框">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">打开设置弹窗</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>阅读设置</DialogTitle>
                  <DialogDescription>
                    弹窗用于设置、导入确认等。这是自测占位。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">取消</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button>确定</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Section>

          <Section title="日文阅读字体栈 · font-reading-jp">
            <p className="font-reading-jp text-xl leading-relaxed" lang="ja">
              {JP_SAMPLE}
            </p>
            <p className="text-sm text-muted-foreground">
              明朝系衬线字体，回退到系统日文字体。上方为正文样式预览。
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}


