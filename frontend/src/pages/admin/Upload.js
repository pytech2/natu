import { useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle, Download, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function UploadPage() {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }
      setFile(selectedFile);
      if (!batchName) {
        setBatchName(selectedFile.name.replace('.csv', ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !batchName) {
      toast.error('Please select a file and enter a batch name');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('batch_name', batchName);
      formData.append('authorization', `Bearer ${token}`);

      const response = await axios.post(`${API_URL}/admin/batch/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setResult(response.data);
      toast.success(`Successfully uploaded ${response.data.total_records} properties!`);
      setFile(null);
      setBatchName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'property_id',
      'owner_name',
      'mobile',
      'address',
      'amount',
      'ward'
    ];
    const csvContent = headers.join(',') + '\n' +
      'PROP001,राम कुमार,9876543210,Plot 101 Sector 5 Green Colony,5000,Ward 1\n' +
      'PROP002,Shyam Singh,9876543211,Plot 102 Sector 5 Green Colony,7500,Ward 1';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property_template.csv';
    a.click();
  };

  return (
    <AdminLayout title="Upload Property Data">
      <div data-testid="admin-upload" className="max-w-2xl space-y-6">
        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              CSV File Format
            </CardTitle>
            <CardDescription>
              Upload a CSV file with property data. The file should contain the following columns:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {['property_id', 'owner_name', 'mobile', 'address', 'amount', 'ward'].map((col) => (
                <div key={col} className="px-3 py-2 bg-slate-100 rounded-md text-sm font-mono text-slate-700">
                  {col}
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              data-testid="download-template-btn"
              className="w-full md:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template CSV
            </Button>
          </CardContent>
        </Card>

        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Upload Dataset</CardTitle>
            <CardDescription>
              Upload property data for distribution and survey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batchName">Batch Name</Label>
              <Input
                id="batchName"
                data-testid="batch-name-input"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g., Property Tax 2025-26 Batch 1"
              />
            </div>

            <div className="space-y-2">
              <Label>CSV File</Label>
              <div
                className={`photo-upload-area ${file ? 'has-image' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="file-input"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                    <div className="text-left">
                      <p className="font-medium text-slate-900">{file.name}</p>
                      <p className="text-sm text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-slate-600">Click to select CSV file</p>
                    <p className="text-sm text-slate-400">or drag and drop</p>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || !batchName || uploading}
              data-testid="upload-btn"
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              {uploading ? (
                <>
                  <span className="animate-pulse">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Dataset
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-emerald-900">Upload Successful!</h3>
                  <p className="text-emerald-700">{result.message}</p>
                  <p className="text-sm text-emerald-600 mt-1">
                    Batch ID: <span className="font-mono">{result.batch_id}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Tips for successful upload:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>Use UTF-8 encoding for Hindi/local language names</li>
                  <li>Property ID should be unique for each record</li>
                  <li>Area/Zone field is used for bulk assignment to employees</li>
                  <li>GPS coordinates are optional but helpful for verification</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
