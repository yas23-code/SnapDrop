import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Code2, Loader2, Trash2, Eye, Clock, Shield, Download, FileText, Image as ImageIcon, Video, Music, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import snapdropLogo from "@/assets/snapdrop-logo.jpg";

const View = () => {
  const [searchParams] = useSearchParams();
  const [keyInput, setKeyInput] = useState(searchParams.get("key") || "");
  const [pasteData, setPasteData] = useState<{
    code: string;
    views: number;
    created_at: string;
    expires_at: string;
    id: string;
    filename?: string | null;
    delete_after_view?: boolean;
  } | null>(null);
  const [pasteFiles, setPasteFiles] = useState<Array<{
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
  }>>([]);
  const [wasDeletedAfterView, setWasDeletedAfterView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    const initialKey = searchParams.get("key");
    if (initialKey && initialKey.length === 6) {
      handleFetchCode(initialKey);
    }
  }, []);

  useEffect(() => {
    if (!pasteData) return;

    const updateTimer = () => {
      const now = new Date();
      const expiresAt = new Date(pasteData.expires_at);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days} day${days > 1 ? 's' : ''}`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours} hour${hours > 1 ? 's' : ''}`);
      } else {
        setTimeRemaining(`${minutes} minute${minutes > 1 ? 's' : ''}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute instead of every second
    return () => clearInterval(interval);
  }, [pasteData]);

  const handleFetchCode = async (key?: string) => {
    const searchKey = key || keyInput;

    if (!searchKey || searchKey.length !== 6) {
      toast.error("Please enter a valid 6-character key");
      return;
    }

    setIsLoading(true);

    try {
      // Use atomic function to increment views and get previous count
      const { data, error } = await supabase.rpc("increment_paste_views", {
        paste_key: searchKey,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Key not found or has expired");
        setPasteData(null);
        setIsLoading(false);
        return;
      }

      const result = data[0];

      // Check if expired
      const expiresAt = new Date(result.paste_expires_at);
      if (expiresAt < new Date()) {
        toast.error("⚠️ This paste has expired after 30 days and has been deleted.");
        setPasteData(null);
        setIsLoading(false);
        return;
      }

      setPasteData({
        code: result.paste_code,
        views: result.paste_views,
        created_at: result.paste_created_at,
        expires_at: result.paste_expires_at,
        id: result.paste_id,
        filename: result.paste_filename,
        delete_after_view: result.paste_delete_after_view,
      });

      // Add to localStorage history
      const stored = localStorage.getItem("pasteHistory");
      const history = stored ? JSON.parse(stored) : [];
      
      // Check if this paste is not already in history
      if (!history.some((item: { key: string }) => item.key === searchKey)) {
        history.push({
          key: searchKey,
          title: result.paste_filename || undefined,
          createdAt: result.paste_created_at,
          expiresAt: result.paste_expires_at,
        });
        localStorage.setItem("pasteHistory", JSON.stringify(history));
      }

      // Fetch associated files first
      const { data: filesData, error: filesError } = await supabase
        .from('paste_files')
        .select('id, filename, file_type, file_size')
        .eq('paste_id', result.paste_id);

      const hasFiles = filesData && filesData.length > 0;

      // If delete_after_view is enabled and this was the FIRST view (prev_views === 0)
      if (result.paste_delete_after_view && result.prev_views === 0) {
        setWasDeletedAfterView(true);
        
        // If there are NO files, delete the paste immediately
        if (!hasFiles) {
          toast.info("🔒 This paste was viewed once and has been deleted for privacy.");
          
          // Remove from localStorage history
          const stored = localStorage.getItem("pasteHistory");
          if (stored) {
            const history = JSON.parse(stored);
            const updatedHistory = history.filter((item: { key: string }) => item.key !== searchKey);
            localStorage.setItem("pasteHistory", JSON.stringify(updatedHistory));
          }
          
          // Delete the paste after showing the content
          setTimeout(async () => {
            const { error: deleteError } = await supabase
              .from("pastes")
              .delete()
              .eq("key", searchKey);
            
            if (deleteError) console.error("Error auto-deleting paste:", deleteError);
          }, 500);
        } else {
          // If there are files, show message but don't delete paste yet
          // Files will be deleted individually when accessed
          toast.info("🔒 This content and files will be deleted after viewing.");
        }
      }

      if (filesData) {
        setPasteFiles(filesData);
      }
    } catch (error) {
      console.error("Error fetching paste:", error);
      toast.error("Failed to fetch paste");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (pasteData) {
      navigator.clipboard.writeText(pasteData.code);
      toast.success("✅ Code copied to clipboard!");
    }
  };

  const handleDelete = async () => {
    if (!keyInput || !pasteData) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase.from("pastes").delete().eq("key", keyInput);

      if (error) throw error;

      toast.success("Paste deleted successfully");
      setPasteData(null);
      setPasteFiles([]);
      setKeyInput("");
      navigate("/view");
    } catch (error) {
      console.error("Error deleting paste:", error);
      toast.error("Failed to delete paste");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src={snapdropLogo} alt="SnapDrop Logo" className="w-10 h-10 object-contain" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              SnapDrop
            </h1>
          </div>
          <p className="text-muted-foreground">Enter a 6-character key to view the paste</p>
        </div>

        <Card className="p-6 shadow-card gradient-card border-border mb-6">
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Enter 6-character key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.slice(0, 6))}
              className="text-2xl text-center tracking-widest font-bold font-mono"
              maxLength={6}
            />
            <Button
              onClick={() => handleFetchCode()}
              disabled={isLoading || keyInput.length !== 6}
              variant="hero"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Loading...
                </>
              ) : (
                "Fetch Code"
              )}
            </Button>
          </div>

          <div className="text-center mt-4">
            <Button variant="link" onClick={() => navigate("/")} className="text-primary">
              ← Create a new paste
            </Button>
          </div>
        </Card>

        {pasteData && (
          <div className="space-y-4">
            <Card className="p-6 shadow-card gradient-card border-border">
              {pasteData.filename && (
                <div className="mb-4 pb-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-primary" />
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {pasteData.filename}
                    </span>
                  </div>
                </div>
              )}
              
              {wasDeletedAfterView && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    🔒 This paste was viewed once and has been deleted for privacy.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>👁️ {pasteData.views} views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>⏳ Expires in {timeRemaining}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    onClick={handleCopyCode} 
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Code
                  </Button>
                  <Button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/view?key=${keyInput}`);
                      toast.success("📋 Link copied to clipboard!");
                    }}
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </Button>
                  <Button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    variant="destructive"
                    size="sm"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {pasteData.code && (
                <div className="rounded-lg overflow-hidden border border-border">
                  <SyntaxHighlighter
                    language="javascript"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: "1.5rem",
                      background: "hsl(220 25% 10%)",
                      fontSize: "0.875rem",
                    }}
                    showLineNumbers
                  >
                    {pasteData.code}
                  </SyntaxHighlighter>
                </div>
              )}
            </Card>

            {pasteFiles.length > 0 && (
              <Card className="p-6 shadow-card gradient-card border-border">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Attached Files ({pasteFiles.length})
                </h3>
                
                {pasteData.delete_after_view && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      ⚠️ Files will be deleted after first preview. Downloading is disabled.
                    </p>
                  </div>
                )}
                
                <div className="space-y-3">
                  {pasteFiles.map((file) => {
                    const getFileIcon = () => {
                      if (file.file_type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-primary" />;
                      if (file.file_type.startsWith('video/')) return <Video className="w-5 h-5 text-primary" />;
                      if (file.file_type.startsWith('audio/')) return <Music className="w-5 h-5 text-primary" />;
                      if (file.file_type === 'application/pdf') return <FileText className="w-5 h-5 text-primary" />;
                      if (file.file_type.includes('zip') || file.file_type.includes('rar')) return <Archive className="w-5 h-5 text-primary" />;
                      return <FileText className="w-5 h-5 text-primary" />;
                    };

                    const isImage = file.file_type.startsWith('image/');
                    const isVideo = file.file_type.startsWith('video/');
                    const isPDF = file.file_type === 'application/pdf';
                    const isPreviewable = isImage || isVideo || isPDF;
                    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
                    const fileUrl = `https://${projectId}.supabase.co/functions/v1/download-file?fileId=${file.id}&key=${keyInput}`;

                    return (
                      <div key={file.id} className="border border-border rounded-lg p-4 bg-background/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {getFileIcon()}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{file.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.file_size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          
                          {!pasteData.delete_after_view ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                window.open(fileUrl, '_blank');
                              }}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (confirm('⚠️ This file will be permanently deleted after viewing. Continue?')) {
                                  setViewedFiles(prev => new Set([...prev, file.id]));
                                  toast.info("🔒 File will be deleted after viewing");
                                }
                              }}
                              disabled={viewedFiles.has(file.id)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              {viewedFiles.has(file.id) ? 'Viewed' : 'View Once'}
                            </Button>
                          )}
                        </div>
                        
                        {pasteData.delete_after_view && !isPreviewable && (
                          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                            <p className="text-sm text-muted-foreground mb-3">
                              ⚠️ This file cannot be previewed in the browser.
                            </p>
                            <p className="text-xs text-muted-foreground mb-4">
                              Click "View Once" above to download. It will be permanently deleted after access.
                            </p>
                          </div>
                        )}
                        
                        {isImage && (viewedFiles.has(file.id) || !pasteData.delete_after_view) && (
                          <div>
                            {pasteData.delete_after_view && (
                              <p className="text-xs text-destructive mb-2">
                                🔒 This image will be deleted after viewing
                              </p>
                            )}
                            <img
                              src={fileUrl}
                              alt={file.filename}
                              className="w-full rounded-lg border border-border"
                              loading="lazy"
                              style={{ imageRendering: 'auto' }}
                            />
                          </div>
                        )}
                        
                        {isVideo && (viewedFiles.has(file.id) || !pasteData.delete_after_view) && (
                          <div>
                            {pasteData.delete_after_view && (
                              <p className="text-xs text-destructive mb-2">
                                🔒 This video will be deleted after viewing
                              </p>
                            )}
                            <video
                              controls
                              className="w-full rounded-lg border border-border"
                              preload="metadata"
                              controlsList={pasteData.delete_after_view ? "nodownload" : undefined}
                            >
                              <source src={fileUrl} type={file.file_type} />
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        )}
                        
                        {isPDF && (viewedFiles.has(file.id) || !pasteData.delete_after_view) && (
                          <div>
                            {pasteData.delete_after_view && (
                              <p className="text-xs text-destructive mb-2">
                                🔒 This PDF will be deleted after viewing
                              </p>
                            )}
                            <iframe
                              src={fileUrl}
                              className="w-full h-[600px] rounded-lg border border-border"
                              title={file.filename}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-muted-foreground border-t border-border pt-6">
          <p className="flex items-center justify-center gap-2">
            📧 Email us: <a href="mailto:snapdrop.query24@gmail.com" className="text-primary hover:underline">snapdrop.query24@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default View;
