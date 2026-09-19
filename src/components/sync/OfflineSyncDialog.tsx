import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileKey2, HardDrive, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useGroupContext } from "@/contexts/GroupContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { NearbySyncPanel } from "./NearbySyncPanel";
import { usePreferences } from "@/contexts/PreferencesContext";

interface OfflineSyncDialogProps {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_PASSPHRASE_LENGTH = 8;

export default function OfflineSyncDialog({ groupId, groupName, open, onOpenChange }: OfflineSyncDialogProps) {
  const { exportGroupArchive, importGroupArchive } = useGroupContext();
  const { t } = usePreferences();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportConfirmation, setExportConfirmation] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const closeAfterNearbySync = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (open) return;
    setExportPassphrase("");
    setExportConfirmation("");
    setImportPassphrase("");
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open]);

  const handleExport = async () => {
    if (exportPassphrase.length < MIN_PASSPHRASE_LENGTH) {
      toast({ title: t('passphraseTooShort'), description: t('useAtLeastCharacters'), variant: "destructive" });
      return;
    }
    if (exportPassphrase !== exportConfirmation) {
      toast({ title: t('passphrasesDoNotMatch'), description: t('reenterPassphrase'), variant: "destructive" });
      return;
    }

    setIsExporting(true);
    try {
      const { blob, filename } = await exportGroupArchive(groupId, exportPassphrase);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast({ title: t('encryptedSyncCreated'), description: t('encryptedSyncCreatedBody', { filename }) });
      setExportPassphrase("");
      setExportConfirmation("");
    } catch (error) {
      toast({ title: t('exportFailed'), description: error instanceof Error ? error.message : t('syncCreateFailed'), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({ title: t('chooseSyncFile'), description: t('chooseSyncFileBody'), variant: "destructive" });
      return;
    }
    if (!importPassphrase) {
      toast({ title: t('enterPassphrase'), description: t('enterPassphraseBody'), variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      const result = await importGroupArchive(importFile, importPassphrase);
      const recordSummary = t('importSummary', { members: result.memberCount, expenses: result.expenseCount });
      toast({
        title: result.status === "added" ? t('groupImported') : t('offlineChangesMerged'),
        description: t('importComplete', { groupName: result.groupName, summary: recordSummary }),
      });
      setImportPassphrase("");
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onOpenChange(false);
    } catch (error) {
      toast({ title: t('importFailed'), description: error instanceof Error ? error.message : t('importFailedBody'), variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <HardDrive className="h-5 w-5 text-emerald-400" />
          </div>
          <DialogTitle>{t('syncBackup')}</DialogTitle>
          <DialogDescription>
            {t('syncBackupHelp', { groupName })}
          </DialogDescription>
        </DialogHeader>

        <NearbySyncPanel groupId={groupId} groupName={groupName} onComplete={closeAfterNearbySync} />

        <Tabs defaultValue="export" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2"><Download className="h-4 w-4" />{t('export')}</TabsTrigger>
            <TabsTrigger value="import" className="gap-2"><Upload className="h-4 w-4" />{t('import')}</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="mt-5 space-y-4">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>{t('encryptedOnDevice')}</AlertTitle>
              <AlertDescription>{t('encryptedOnDeviceBody')}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="sync-export-passphrase">{t('passphrase')}</Label>
              <Input
                id="sync-export-passphrase"
                type="password"
                autoComplete="new-password"
                value={exportPassphrase}
                onChange={(event) => setExportPassphrase(event.target.value)}
                placeholder={t('atLeastCharacters')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-export-confirmation">{t('confirmPassphrase')}</Label>
              <Input
                id="sync-export-confirmation"
                type="password"
                autoComplete="new-password"
                value={exportConfirmation}
                onChange={(event) => setExportConfirmation(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handleExport()}
                placeholder={t('enterAgain')}
              />
            </div>
            <Button onClick={() => void handleExport()} disabled={isExporting} className="app-button-primary w-full gap-2">
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileKey2 className="h-4 w-4" />}
              {t('createEncryptedFile')}
            </Button>
          </TabsContent>

          <TabsContent value="import" className="mt-5 space-y-4">
            <Alert>
              <Upload className="h-4 w-4" />
              <AlertTitle>{t('mergeNotOverwrite')}</AlertTitle>
              <AlertDescription>{t('mergeNotOverwriteBody')}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="sync-import-file">{t('encryptedSyncFile')}</Label>
              <Input
                ref={fileInputRef}
                id="sync-import-file"
                type="file"
                accept=".going-dutch-sync,application/octet-stream,application/json"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
              />
              {importFile && <p className="truncate text-xs text-muted-foreground">{importFile.name} · {(importFile.size / 1024).toFixed(1)} KB</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-import-passphrase">{t('passphrase')}</Label>
              <Input
                id="sync-import-passphrase"
                type="password"
                autoComplete="current-password"
                value={importPassphrase}
                onChange={(event) => setImportPassphrase(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handleImport()}
                placeholder={t('passphraseUsedForExport')}
              />
            </div>
            <Button onClick={() => void handleImport()} disabled={isImporting} className="app-button-primary w-full gap-2">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t('importAndMerge')}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
