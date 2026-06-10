import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import {
  ArrowRight,
  Tags,
  FileText,
  Users,
  Shield,
  Brain,
  Workflow,
  Download,
  Layers,
  ClipboardList,
  Mic,
  Image,
  Video,
  Check,
  Zap,
  BarChart3,
  Globe,
  ChevronRight,
} from "lucide-react";
import VLLogo from "@/assets/VL-logo.svg";

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className="text-center mb-16 max-w-2xl mx-auto"
    >
      <span className="text-primary text-sm font-semibold uppercase tracking-widest">{eyebrow}</span>
      <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4 text-foreground">{title}</h2>
      <p className="text-muted-foreground text-lg">{description}</p>
    </motion.div>
  );
}

function FeatureCard({ icon: Icon, title, description, index }: { icon: React.ElementType; title: string; description: string; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="group relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-6 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_40px_-12px_hsl(var(--primary)/0.2)]"
    >
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <p className="text-4xl md:text-5xl font-bold text-primary">{value}</p>
      <p className="text-muted-foreground text-sm mt-1">{label}</p>
    </motion.div>
  );
}

function WorkflowStep({ step, title, description, index }: { step: string; title: string; description: string; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15 }}
      className="flex items-start gap-5"
    >
      <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 glow-primary">
        {step}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

const FEATURES = [
  { icon: Layers, title: "Project Management", description: "Organize annotation work into projects with configurable data types, annotation schemas, and detailed guidelines for your team." },
  { icon: Tags, title: "Smart Labeling", description: "Create custom label sets with color coding. Supports classification, NER, bounding boxes, segmentation, and more." },
  { icon: FileText, title: "Multi-Format Support", description: "Annotate text, images, audio, video, PDFs, and tabular data with specialized tools for each format." },
  { icon: Brain, title: "AI-Powered Pipelines", description: "Build no-code pipelines with AI models like Whisper and Pyannote for automatic transcription, diarization, and tagging." },
  { icon: ClipboardList, title: "Task Management", description: "Split data into tasks and sub-tasks, assign to annotators, and track progress with real-time status updates." },
  { icon: Users, title: "Team & RBAC", description: "Invite members, assign roles (Admin, Manager, Annotator), and enforce access control across every feature." },
  { icon: Download, title: "Flexible Exports", description: "Export annotated datasets in JSON, CSV, or custom formats ready for model training." },
  { icon: Shield, title: "Secure & Private", description: "Row-level security, encrypted storage, and enterprise-grade access policies protect your data at every layer." },
];

const DATA_TYPES = [
  { icon: FileText, label: "Text" },
  { icon: Image, label: "Images" },
  { icon: Mic, label: "Audio" },
  { icon: Video, label: "Video" },
  { icon: FileText, label: "PDFs" },
  { icon: BarChart3, label: "Tabular" },
];

const WORKFLOW_STEPS = [
  { step: "1", title: "Create a Project", description: "Set up your annotation project — pick the data type, annotation schema, and write guidelines for your team." },
  { step: "2", title: "Upload & Organize Data", description: "Upload files in any supported format. They're automatically organized and ready for annotation." },
  { step: "3", title: "Assign Tasks", description: "Split data into tasks and assign them to annotators. Track progress in real-time." },
  { step: "4", title: "Annotate with Precision", description: "Use specialized annotation tools tailored to each data format — from text spans to audio segments." },
  { step: "5", title: "Export & Train", description: "Export your annotated dataset in your preferred format and feed it directly into your ML pipeline." },
];

const SERVICES = [
  {
    icon: Tags,
    title: "Manual Data Tagging",
    description: "Our expert annotators meticulously label your datasets with precision. From text classification and named entity recognition to image bounding boxes and audio segmentation — we handle every data type with domain-specific accuracy.",
    features: ["Text, image, audio & video annotation", "Custom label schemas & guidelines", "Multi-round quality assurance", "Scalable workforce for any volume"],
  },
  {
    icon: Brain,
    title: "Training AI Models",
    description: "We go beyond labeling — our team trains and fine-tunes AI models on your annotated data. Get production-ready models optimized for your specific use case, from NLP classifiers to computer vision detectors.",
    features: ["Custom model training & fine-tuning", "Transfer learning on your domain data", "Model evaluation & benchmarking", "Deployment-ready model delivery"],
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { scrollYProgress } = useScroll();

  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const bgParallax = useTransform(scrollYProgress, [0, 1], [0, -300]);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Floating background elements */}
      <motion.div style={{ y: bgParallax }} className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[10%] left-[15%] w-96 h-96 rounded-full bg-primary/5 blur-[128px]" />
        <div className="absolute top-[40%] right-[10%] w-80 h-80 rounded-full bg-accent/5 blur-[100px]" />
        <div className="absolute bottom-[20%] left-[40%] w-72 h-72 rounded-full bg-primary/3 blur-[120px]" />
      </motion.div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={VLLogo} alt="Veri Label" className="w-9 h-9 rounded-lg" />
            <span className="font-bold text-xl text-foreground">Veri Label</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#workflow" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="gradient-primary text-primary-foreground">
              Get Started
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative container mx-auto px-6 pt-24 pb-32 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Data Annotation Platform
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6">
            <span className="text-foreground">Label Your Data.</span>
            <br />
            <span className="text-gradient">Train Better Models.</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            The complete annotation platform for ML teams. Manage projects, assign tasks, 
            build AI pipelines, and export production-ready datasets — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/auth")} className="gradient-primary text-primary-foreground glow-primary text-base px-8">
              Start Annotating Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="text-base px-8">
              Watch Demo
            </Button>
          </div>
        </motion.div>

        {/* Hero visual */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="mt-20 relative max-w-5xl mx-auto"
        >
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-primary/10 to-transparent blur-2xl -z-10" />
          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden shadow-2xl">
            {/* Mock app bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-card/90">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="h-5 w-48 rounded bg-secondary/60" />
              </div>
            </div>
            {/* Mock content */}
            <div className="flex">
              {/* Sidebar mock */}
              <div className="w-48 border-r border-border/40 p-3 space-y-2 hidden md:block">
                {["Dashboard", "Projects", "Data", "Tasks", "Pipelines"].map((item, i) => (
                  <div key={item} className={`rounded-lg px-3 py-2 text-xs ${i === 1 ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground"}`}>
                    {item}
                  </div>
                ))}
              </div>
              {/* Main area */}
              <div className="flex-1 p-6">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {["12 Files", "847 Labels", "3 Tasks"].map((stat) => (
                    <div key={stat} className="rounded-lg bg-secondary/40 p-3 text-center">
                      <p className="text-xs text-muted-foreground">{stat.split(" ")[1]}</p>
                      <p className="text-lg font-bold text-foreground">{stat.split(" ")[0]}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[80, 55, 30].map((w, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                        <Tags className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="h-2 rounded bg-secondary" style={{ width: `${w}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{w}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* Data type pills */}
      <section className="container mx-auto px-6 pb-20">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {DATA_TYPES.map(({ icon: Icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-6 py-16">
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard value="6+" label="Data Formats" />
          <StatCard value="8+" label="Annotation Types" />
          <StatCard value="3" label="Team Roles" />
          <StatCard value="∞" label="Projects" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-6 py-24">
        <SectionHeading
          eyebrow="Features"
          title="Everything You Need for Data Annotation"
          description="From project setup to model-ready exports, Veri Label covers the entire annotation lifecycle."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} index={i} />
          ))}
        </div>
      </section>

      {/* Pipeline Builder Highlight */}
      <section className="container mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-primary text-sm font-semibold uppercase tracking-widest">No-Code Pipelines</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4 text-foreground">
              Automate with Visual Pipeline Builder
            </h2>
            <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
              Drag-and-drop AI blocks, transforms, and conditions to build automated tagging workflows. 
              Connect Whisper for transcription, Pyannote for diarization, and custom logic — all without writing code.
            </p>
            <ul className="space-y-3">
              {["AI model blocks (Whisper, Pyannote, custom)", "Conditional branching logic", "Auto-save with change detection", "Dark mode canvas support"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                  <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl border border-border bg-card/60 p-6"
          >
            {/* Pipeline mock */}
            <div className="space-y-4">
              {[
                { label: "Audio Input", color: "bg-primary/15 border-primary/30 text-primary", icon: Mic },
                { label: "Whisper Transcription", color: "bg-[hsl(var(--tag-purple)/0.15)] border-[hsl(var(--tag-purple)/0.3)] text-[hsl(var(--tag-purple))]", icon: Brain },
                { label: "Sentiment Filter", color: "bg-[hsl(var(--tag-yellow)/0.15)] border-[hsl(var(--tag-yellow)/0.3)] text-[hsl(var(--tag-yellow))]", icon: Workflow },
                { label: "Export Tags", color: "bg-[hsl(var(--tag-green)/0.15)] border-[hsl(var(--tag-green)/0.3)] text-[hsl(var(--tag-green))]", icon: Download },
              ].map((block, i) => (
                <div key={block.label}>
                  <div className={`flex items-center gap-3 rounded-xl border p-4 ${block.color}`}>
                    <block.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{block.label}</span>
                  </div>
                  {i < 3 && (
                    <div className="flex justify-center py-1">
                      <div className="w-0.5 h-4 bg-border" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="workflow" className="container mx-auto px-6 py-24">
        <SectionHeading
          eyebrow="Workflow"
          title="From Raw Data to Trained Models"
          description="Five simple steps to go from unstructured data to production-ready annotated datasets."
        />
        <div className="max-w-2xl mx-auto space-y-8">
          {WORKFLOW_STEPS.map((s, i) => (
            <WorkflowStep key={s.step} {...s} index={i} />
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="container mx-auto px-6 py-24">
        <SectionHeading
          eyebrow="Services"
          title="End-to-End Data & AI Services"
          description="From raw data labeling to trained models — we deliver production-ready AI solutions."
        />
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {SERVICES.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-8 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_40px_-12px_hsl(var(--primary)/0.2)] flex flex-col"
            >
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <service.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{service.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{service.description}</p>
              <ul className="space-y-2.5 flex-1 mb-6">
                {service.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/auth")}
                variant="outline"
                className="w-full"
              >
                Learn More
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-0 gradient-primary opacity-10" />
          <div className="absolute inset-0 bg-card/80 backdrop-blur-sm" />
          <div className="relative z-10 px-8 py-16 md:py-20 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Ready to Annotate Smarter?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join ML teams using Veri Label to build high-quality training datasets faster than ever.
            </p>
            <Button size="lg" onClick={() => navigate("/auth")} className="gradient-primary text-primary-foreground glow-primary text-base px-10">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={VLLogo} alt="Veri Label" className="w-8 h-8 rounded-lg" />
              <span className="font-bold text-foreground">Veri Label</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#workflow" className="hover:text-foreground transition-colors">How It Works</a>
              <a href="#services" className="hover:text-foreground transition-colors">Services</a>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 Veri Label. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
