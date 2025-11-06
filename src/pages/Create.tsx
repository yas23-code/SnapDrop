import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Code2, Loader2, Shield, Upload, X, FileText, Image as ImageIcon, Video, Music, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PasteHistory } from "@/components/PasteHistory";
import snapdropLogo from "@/assets/snapdrop-logo.jpg";

// Configurable paste expiry duration (in days)
const PASTE_EXPIRY_DAYS = 30;

const Create = () => {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [filename, setFilename] = useState("");
  const [deleteAfterView, setDeleteAfterView] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const navigate = useNavigate();

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 6; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const handleGenerateKey = async () => {
    if (!code.trim() && files.length === 0) {
      toast.error("Please enter some code/text or upload files");
      return;
    }

    setIsLoading(true);

    try {
      // Generate unique 6-digit key
      let key = generateKey();
      let attempts = 0;
      const maxAttempts = 10;

      // Try to find a unique key
      while (attempts < maxAttempts) {
        const { data: existing } = await supabase
          .from("pastes")
          .select("key")
          .eq("key", key)
          .maybeSingle();

        if (!existing) break;
        key = generateKey();
        attempts++;
      }

      if (attempts === maxAttempts) {
        toast.error("Failed to generate unique key. Please try again.");
        setIsLoading(false);
        return;
      }

      // Calculate expiry (PASTE_EXPIRY_DAYS from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + PASTE_EXPIRY_DAYS);

      // Insert the paste
      const { data: pasteData, error } = await supabase.from("pastes").insert({
        key,
        code: code.trim() || "",
        filename: filename.trim() || null,
        expires_at: expiresAt.toISOString(),
        delete_after_view: deleteAfterView,
      }).select().single();

      if (error) throw error;

      // Upload files if any
      if (files.length > 0) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const filePath = `${key}/${crypto.randomUUID()}.${fileExt}`;
          
          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('paste-files')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Save file metadata
          const { error: fileError } = await supabase.from('paste_files').insert({
            paste_id: pasteData.id,
            filename: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: filePath,
          });

          if (fileError) throw fileError;
        }
      }

      // Store in localStorage
      const historyItem = {
        key,
        title: title.trim() || undefined,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      const existingHistory = localStorage.getItem("pasteHistory");
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      history.push(historyItem);
      localStorage.setItem("pasteHistory", JSON.stringify(history));

      setGeneratedKey(key);
      toast.success(`Key generated successfully! Your paste will expire in ${PASTE_EXPIRY_DAYS} days.`);
    } catch (error) {
      console.error("Error creating paste:", error);
      toast.error("Failed to create paste. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      toast.success("🔑 Key copied to clipboard!");
    }
  };

  const handleReset = () => {
    setCode("");
    setTitle("");
    setFilename("");
    setDeleteAfterView(false);
    setGeneratedKey(null);
    setFiles([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src={snapdropLogo} alt="SnapDrop Logo" className="w-12 h-12 object-contain" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              SnapDrop
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Share anything instantly 🔐
          </p>
        </div>

        <Card className="p-8 shadow-card gradient-card border-border">
          {!generatedKey ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Title (optional)
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., API Response Handler"
                  className="text-sm bg-background/50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Filename (optional)
                </label>
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="e.g., index.js, App.tsx, main.py..."
                  className="font-mono text-sm bg-background/50"
                />
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/30">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div>
                    <Label htmlFor="delete-after-view" className="text-sm font-medium cursor-pointer">
                      Delete after first view
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automatically delete this paste after it's viewed once (secure sharing)
                    </p>
                  </div>
                </div>
                <Switch
                  id="delete-after-view"
                  checked={deleteAfterView}
                  onCheckedChange={setDeleteAfterView}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Paste your code or text
                </label>
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter your code, text, or anything you want to share..."
                  className="min-h-[200px] font-mono text-sm bg-background/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Attach files (optional)
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Files
                    </Button>
                  </div>
                  {files.length > 0 && (
                    <div className="space-y-2">
                      {files.map((file, index) => {
                        const getFileIcon = () => {
                          if (file.type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
                          if (file.type.startsWith('video/')) return <Video className="w-4 h-4" />;
                          if (file.type.startsWith('audio/')) return <Music className="w-4 h-4" />;
                          if (file.type.includes('zip') || file.type.includes('rar')) return <Archive className="w-4 h-4" />;
                          return <FileText className="w-4 h-4" />;
                        };

                        return (
                          <div key={index} className="flex items-center justify-between p-2 rounded border border-border bg-background/30">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {getFileIcon()}
                              <span className="text-sm truncate">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleGenerateKey}
                disabled={isLoading}
                variant="hero"
                size="lg"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Key"
                )}
              </Button>

              <div className="flex flex-col items-center gap-3">
                <PasteHistory />
                <Button
                  variant="link"
                  onClick={() => navigate("/view")}
                  className="text-primary"
                >
                  Have a key? View a paste →
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <div className="py-8">
                <p className="text-muted-foreground mb-4">Your key is:</p>
                <div className="text-6xl font-bold text-primary tracking-wider mb-6 shadow-glow font-mono">
                  {generatedKey}
                </div>
                <p className="text-sm text-muted-foreground">
                  This key will expire in {PASTE_EXPIRY_DAYS} days
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <Button
                    onClick={handleCopyKey}
                    variant="hero"
                    size="lg"
                    className="flex-1 gap-2"
                  >
                    <Copy />
                    Copy Key
                  </Button>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/view?key=${generatedKey}`);
                      toast.success("🔗 Link copied to clipboard!");
                    }}
                    variant="hero"
                    size="lg"
                    className="flex-1 gap-2"
                  >
                    <Copy />
                    Copy Link
                  </Button>
                </div>
                <Button onClick={handleReset} variant="outline" size="lg" className="w-full">
                  Create Another
                </Button>
              </div>

              <Button
                variant="link"
                onClick={() => navigate(`/view?key=${generatedKey}`)}
                className="text-primary"
              >
                View your paste →
              </Button>
            </div>
          )}
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>All pastes automatically expire after {PASTE_EXPIRY_DAYS} days</p>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground border-t border-border pt-6">
          <p className="flex items-center justify-center gap-2">
            📧 Email us: <a href="mailto:snapdrop.query24@gmail.com" className="text-primary hover:underline">snapdrop.query24@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Create;
