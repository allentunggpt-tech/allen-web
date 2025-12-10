// --- 這裡改用網址載入 (CDN)，不需要安裝 npm ---
import React, { useState, useRef, useMemo, useEffect } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';

// 載入圖示庫
import { 
  LayoutDashboard, ArrowUpFromLine, ArrowDownToLine, Upload, FileSpreadsheet, 
  Search, Package, Menu, X, Filter, CheckSquare, Square, User, LogOut, LogIn, 
  CheckCircle2, ArrowRightLeft, Trash2, AlertTriangle, Info, Plus, Calendar, 
  ClipboardCheck, RefreshCcw, AlertCircle, Smartphone, Monitor 
} from 'https://esm.sh/lucide-react@0.292.0';

// --- 以下是原本的程式碼，完全不需要動 ---

const NotificationToast = ({ notification }) => {
  if (!notification) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-in slide-in-from-bottom-5 duration-300 z-[60]">
      <CheckCircle2 className="text-green-400" size={20} />
      <span className="font-medium">{notification.message}</span>
    </div>
  );
};

const SidebarItem = ({ id, label, icon: Icon, badgeCount, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 mb-1 ${
      isActive 
        ? 'bg-blue-600 text-white shadow-md' 
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <div className="flex items-center space-x-3">
      <Icon size={20} />
      <span className="font-medium tracking-wide">{label}</span>
    </div>
    {badgeCount > 0 && (
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'}`}>
        {badgeCount}
      </span>
    )}
  </button>
);

const StatusBadge = ({ status, borrower }) => {
  if (status === 'borrowed') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
        <User size={12} className="mr-1" />
        {borrower} 借用中
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200">
      在庫
    </span>
  );
};

function App() {
  // --- 狀態管理 ---
  const [activeTab, setActiveTab] = useState('master'); 
  const [inventoryData, setInventoryData] = useState([]); // 庫存資料 (總表)
  const [borrowingData, setBorrowingData] = useState([]); // 借入資料 (向別人借)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [searchTerm, setSearchTerm] = useState(""); 
  
  // 手機模擬模式狀態
  const [isMobileSimulation, setIsMobileSimulation] = useState(false);

  // 分類篩選
  const [selectedCategories, setSelectedCategories] = useState([]); 
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false); 
  
  // 借出功能 (庫存 -> 借出) 相關狀態
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [currentLendItemId, setCurrentLendItemId] = useState(null); 
  const [borrowerName, setBorrowerName] = useState(""); 
  const [lendError, setLendError] = useState("");
  
  // 新增借入料件 (外部 -> 借入) 相關狀態
  const [isAddBorrowModalOpen, setIsAddBorrowModalOpen] = useState(false);
  const [newBorrowItem, setNewBorrowItem] = useState({
    itemNumber: '',
    description: '',
    category: '',
    lender: '',
    borrowDate: new Date().toISOString().split('T')[0]
  });
  const [addBorrowError, setAddBorrowError] = useState("");

  // 盤點功能相關狀態
  const [stocktakingResults, setStocktakingResults] = useState(null); // { missing: [], extra: [], matchCount: 0 }
  const stocktakingFileRef = useRef(null);

  // 確認對話框狀態
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    type: 'return', // 'return'(歸還庫存), 'transfer'(庫存轉帳), 'return_borrow'(歸還借入), 'transfer_borrow'(借入轉庫存)
    itemId: null,
    itemNumber: '',
    targetName: '' // 借用人 或 借出人
  });

  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  // --- 計算邏輯 ---

  const currentLendItem = useMemo(() => {
    return inventoryData.find(item => item.id === currentLendItemId);
  }, [inventoryData, currentLendItemId]);

  const uniqueCategories = useMemo(() => {
    const categories = inventoryData.map(item => item.category).filter(c => c);
    return [...new Set(categories)];
  }, [inventoryData]);

  // 庫存中被借出的資料
  const lendedData = useMemo(() => {
    return inventoryData.filter(item => item.status === 'borrowed');
  }, [inventoryData]);

  const filteredInventoryData = inventoryData.filter(item => {
    const matchesSearch = 
      item.itemNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.borrower && item.borrower.toLowerCase().includes(searchTerm.toLowerCase())); 
    
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category);

    return matchesSearch && matchesCategory;
  });

  // --- 輔助函數 ---

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000); 
  };

  const parseCSVLine = (text) => {
    const result = [];
    let cell = '';
    let insideQuote = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (insideQuote && text[i + 1] === '"') {
          cell += '"';
          i++; 
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        result.push(cell);
        cell = '';
      } else {
        cell += char;
      }
    }
    result.push(cell);
    return result;
  };

  // 處理主料件總表匯入
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      try {
        const lines = text.split(/\r?\n/);
        const newData = lines
          .filter(line => line.trim() !== '') 
          .slice(1) 
          .map((line, index) => {
            const columns = parseCSVLine(line);
            if (columns.length < 2) return null;
            return {
              id: `csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
              itemNumber: columns[1]?.trim() || "", 
              description: columns[2]?.trim() || "",
              category: columns[3]?.trim() || "",
              status: 'in_stock',
              borrower: '',
              borrowDate: ''
            };
          })
          .filter(item => item !== null && item.itemNumber); 

        setInventoryData(newData);
        setSelectedCategories([]); 
        showNotification(`成功匯入 ${newData.length} 筆資料`);
        event.target.value = null;
      } catch (error) {
        console.error(error);
        alert("檔案解析失敗，請確認格式是否為 CSV。");
      }
    };
    reader.readAsText(file);
  };

  // 處理盤點檔案匯入與比對
  const handleStocktakingUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (inventoryData.length === 0) {
      alert("請先在「料件管理總表」匯入系統庫存資料，才能進行盤點比對。");
      event.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      try {
        const lines = text.split(/\r?\n/);
        // 解析盤點檔案 (假設格式類似，欄位1是料號)
        const scannedItems = lines
          .filter(line => line.trim() !== '') 
          .slice(1) 
          .map((line) => {
            const columns = parseCSVLine(line);
            if (columns.length < 2) return null;
            return {
              itemNumber: columns[1]?.trim() || "", 
              description: columns[2]?.trim() || "", // 選擇性讀取描述
              category: columns[3]?.trim() || ""     // 選擇性讀取分類
            };
          })
          .filter(item => item !== null && item.itemNumber);

        // 開始比對
        const systemItemMap = new Map(inventoryData.map(i => [i.itemNumber.toLowerCase(), i]));
        const scannedItemMap = new Map(scannedItems.map(i => [i.itemNumber.toLowerCase(), i]));

        // 1. 找出遺失 (Missing): 系統有，盤點無
        const missing = inventoryData.filter(sysItem => !scannedItemMap.has(sysItem.itemNumber.toLowerCase()));

        // 2. 找出多出 (Extra): 盤點有，系統無
        const extra = scannedItems.filter(scanItem => !systemItemMap.has(scanItem.itemNumber.toLowerCase()));

        // 3. 計算吻合數
        const matchCount = inventoryData.length - missing.length;

        setStocktakingResults({
          missing,
          extra,
          matchCount,
          totalSystem: inventoryData.length,
          totalScanned: scannedItems.length,
          timestamp: new Date().toLocaleString()
        });

        showNotification("盤點比對完成");
        event.target.value = null;

      } catch (error) {
        console.error(error);
        alert("盤點檔案解析失敗，請確認格式。");
      }
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const triggerStocktakingInput = () => {
    stocktakingFileRef.current.click();
  };

  const toggleCategory = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleSidebarClick = (id) => {
    setActiveTab(id);
    if (isMobileSimulation || window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const openLendModal = (itemId) => {
    setCurrentLendItemId(itemId);
    setBorrowerName(""); 
    setLendError("");
    setIsLendModalOpen(true);
  };

  const confirmLend = () => {
    if (!borrowerName.trim()) {
      setLendError("請輸入借用人姓名");
      return;
    }
    const today = new Date().toISOString().split('T')[0]; 
    setInventoryData(prevData => prevData.map(item => {
      if (item.id === currentLendItemId) {
        return { ...item, status: 'borrowed', borrower: borrowerName, borrowDate: today };
      }
      return item;
    }));
    setIsLendModalOpen(false);
    showNotification(`已成功借出給：${borrowerName}`);
  };

  const handleAddBorrowItem = () => {
    const { itemNumber, description, category, lender, borrowDate } = newBorrowItem;
    if (!itemNumber || !lender) {
      setAddBorrowError("料號與借出人為必填欄位");
      return;
    }

    const newItem = {
      id: `borrow-${Date.now()}`,
      itemNumber,
      description,
      category,
      lender,
      borrowDate
    };

    setBorrowingData(prev => [...prev, newItem]);
    setIsAddBorrowModalOpen(false);
    setNewBorrowItem({
      itemNumber: '',
      description: '',
      category: '',
      lender: '',
      borrowDate: new Date().toISOString().split('T')[0]
    });
    showNotification("已新增借入料件");
  };

  const initiateReturn = (item) => {
    setConfirmState({
      isOpen: true,
      type: 'return',
      itemId: item.id,
      itemNumber: item.itemNumber,
      targetName: item.borrower
    });
  };

  const initiateTransfer = (item) => {
    setConfirmState({
      isOpen: true,
      type: 'transfer',
      itemId: item.id,
      itemNumber: item.itemNumber,
      targetName: item.borrower
    });
  };

  const initiateBorrowReturn = (item) => {
    setConfirmState({
      isOpen: true,
      type: 'return_borrow',
      itemId: item.id,
      itemNumber: item.itemNumber,
      targetName: item.lender
    });
  };

  const initiateBorrowTransfer = (item) => {
    setConfirmState({
      isOpen: true,
      type: 'transfer_borrow',
      itemId: item.id,
      itemNumber: item.itemNumber,
      targetName: item.lender
    });
  };

  const executeConfirmAction = () => {
    const { type, itemId, itemNumber } = confirmState;

    if (type === 'return') {
      setInventoryData(prev => prev.map(d => 
        d.id === itemId ? { ...d, status: 'in_stock', borrower: '', borrowDate: '' } : d
      ));
      showNotification(`${itemNumber} 已歸還入庫`);

    } else if (type === 'transfer') {
      setInventoryData(prev => prev.filter(d => d.id !== itemId));
      showNotification(`${itemNumber} 已轉帳並從清單移除`);

    } else if (type === 'return_borrow') {
      setBorrowingData(prev => prev.filter(d => d.id !== itemId));
      showNotification(`${itemNumber} 已歸還給原主，並從清單移除`);

    } else if (type === 'transfer_borrow') {
      const itemToTransfer = borrowingData.find(d => d.id === itemId);
      if (itemToTransfer) {
        setBorrowingData(prev => prev.filter(d => d.id !== itemId));
        const newInventoryItem = {
          id: `trans-${Date.now()}`,
          itemNumber: itemToTransfer.itemNumber,
          description: itemToTransfer.description,
          category: itemToTransfer.category,
          status: 'in_stock',
          borrower: '',
          borrowDate: ''
        };
        setInventoryData(prev => [...prev, newInventoryItem]);
        showNotification(`${itemNumber} 已轉入公司庫存 (在庫)`);
      }
    }

    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isCategoryFilterOpen && !event.target.closest('.category-filter-container')) {
        setIsCategoryFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCategoryFilterOpen]);

  // 定義 App 的內容元件
  const AppContent = () => (
    <div className={`flex h-full bg-slate-100 font-sans text-slate-900 overflow-hidden relative ${isMobileSimulation ? 'w-full' : ''}`}>
      <NotificationToast notification={notification} />

      {isLendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLendModalOpen(false)}></div>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg flex items-center"><LogOut size={20} className="mr-2" />借出料件</h3>
              <button onClick={() => setIsLendModalOpen(false)} className="text-blue-100 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">料件資訊</label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                  <div className="font-bold text-slate-800">{currentLendItem?.itemNumber}</div>
                  <div className="text-slate-600 mt-1">{currentLendItem?.description}</div>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">借用人姓名 <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={borrowerName}
                    onChange={(e) => { setBorrowerName(e.target.value); if (lendError) setLendError(""); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmLend(); }}
                    placeholder="請輸入姓名或員工編號"
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${lendError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                    autoFocus
                  />
                </div>
                {lendError && <p className="text-red-500 text-xs mt-1 flex items-center"><AlertTriangle size={12} className="mr-1" />{lendError}</p>}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => setIsLendModalOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">取消</button>
                <button onClick={confirmLend} className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition-colors">確認借出</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddBorrowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddBorrowModalOpen(false)}></div>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg flex items-center"><Plus size={20} className="mr-2" />新增借入料件</h3>
              <button onClick={() => setIsAddBorrowModalOpen(false)} className="text-blue-100 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">料號 <span className="text-red-500">*</span></label>
                  <input type="text" value={newBorrowItem.itemNumber} onChange={e => setNewBorrowItem({...newBorrowItem, itemNumber: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如: EXT-001" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">分類</label>
                  <input type="text" value={newBorrowItem.category} onChange={e => setNewBorrowItem({...newBorrowItem, category: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如: 測試設備" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">品名描述</label>
                  <input type="text" value={newBorrowItem.description} onChange={e => setNewBorrowItem({...newBorrowItem, description: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="物品名稱與規格" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">向誰借用 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" value={newBorrowItem.lender} onChange={e => setNewBorrowItem({...newBorrowItem, lender: e.target.value})} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="廠商或人員名稱" />
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">借用日期</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    <input type="date" value={newBorrowItem.borrowDate} onChange={e => setNewBorrowItem({...newBorrowItem, borrowDate: e.target.value})} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
              
              {addBorrowError && <p className="text-red-500 text-xs mb-4 flex items-center"><AlertTriangle size={12} className="mr-1" />{addBorrowError}</p>}
              
              <div className="flex space-x-3">
                <button onClick={() => setIsAddBorrowModalOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">取消</button>
                <button onClick={handleAddBorrowItem} className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition-colors">新增資料</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}></div>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`p-4 flex items-center justify-between ${confirmState.type.includes('transfer') ? 'bg-purple-600' : 'bg-green-600'}`}>
              <h3 className="text-white font-bold text-lg flex items-center">
                {confirmState.type.includes('transfer') ? <ArrowRightLeft size={20} className="mr-2" /> : <LogIn size={20} className="mr-2" />}
                {confirmState.type.includes('transfer') ? '確認轉帳' : '確認歸還'}
              </h3>
              <button onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} className="text-white/80 hover:text-white"><X size={20} /></button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <p className="text-slate-600 mb-2">您確定要執行此操作嗎？</p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">料號：</span>
                    <span className="font-bold text-slate-800">{confirmState.itemNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">對象：</span>
                    <span className="font-bold text-slate-800">{confirmState.targetName}</span>
                  </div>
                </div>
                {confirmState.type === 'transfer' && (
                  <div className="mt-3 flex items-start p-2 bg-red-50 text-red-700 text-xs rounded border border-red-100">
                    <AlertTriangle size={14} className="mr-1.5 mt-0.5 shrink-0" />
                    <span>警告：此操作將料件從清單中<b>永久移除</b> (消耗/核銷)。</span>
                  </div>
                )}
                {confirmState.type === 'transfer_borrow' && (
                  <div className="mt-3 flex items-start p-2 bg-purple-50 text-purple-700 text-xs rounded border border-purple-100">
                    <Info size={14} className="mr-1.5 mt-0.5 shrink-0" />
                    <span>此料件將新增至<b>公司庫存總表</b>，並從借入清單中移除。</span>
                  </div>
                )}
                {confirmState.type === 'return_borrow' && (
                  <div className="mt-3 flex items-start p-2 bg-green-50 text-green-700 text-xs rounded border border-green-100">
                    <Info size={14} className="mr-1.5 mt-0.5 shrink-0" />
                    <span>確認已歸還給原主，此資料將從清單中移除。</span>
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <button onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">取消</button>
                <button 
                  onClick={executeConfirmAction}
                  className={`flex-1 py-2 text-white font-medium rounded-lg shadow-md transition-colors ${
                    confirmState.type.includes('transfer') 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  確認
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isSidebarOpen && (isMobileSimulation || window.innerWidth < 768)) && <div className="fixed inset-0 bg-black/50 z-20" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed ${!isMobileSimulation ? 'md:static' : ''} inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${!isMobileSimulation ? 'md:translate-x-0' : ''}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3"><div className="bg-blue-600 p-2 rounded-lg"><Package className="text-white" size={24} /></div><h1 className="text-xl font-bold text-white tracking-wider">料件管理</h1></div>
          <button className={`${!isMobileSimulation ? 'md:hidden' : ''}`} onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">主選單</div>
          <SidebarItem id="master" label="料件管理總表" icon={LayoutDashboard} isActive={activeTab === 'master'} onClick={() => handleSidebarClick('master')} />
          <SidebarItem id="lending" label="借出料件清單" icon={ArrowUpFromLine} badgeCount={lendedData.length} isActive={activeTab === 'lending'} onClick={() => handleSidebarClick('lending')} />
          <SidebarItem id="borrowing" label="借入料件清單" icon={ArrowDownToLine} isActive={activeTab === 'borrowing'} onClick={() => handleSidebarClick('borrowing')} />
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 mt-6 px-2">進階功能</div>
          <SidebarItem id="stocktaking" label="庫存盤點比對" icon={ClipboardCheck} isActive={activeTab === 'stocktaking'} onClick={() => handleSidebarClick('stocktaking')} />
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">US</div>
            <div className="flex-1"><p className="text-sm font-medium text-white">User Admin</p><p className="text-xs text-slate-500">System Operator</p></div>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full relative w-full">
        <header className={`bg-white border-b border-slate-200 p-4 ${!isMobileSimulation ? 'md:hidden' : ''} flex items-center justify-between`}>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600"><Menu size={24} /></button>
          <span className="font-bold text-slate-800">料件管理系統</span>
          <div className="w-8"></div>
        </header>
        <div className={`flex-1 p-4 ${!isMobileSimulation ? 'md:p-8' : ''} overflow-hidden`}>{renderContent()}</div>
      </main>
    </div>
  );

  return (
    <>
      {isMobileSimulation ? (
        <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
          <div className="w-[375px] h-[750px] bg-black rounded-[3rem] shadow-2xl overflow-hidden border-[8px] border-slate-900 ring-1 ring-slate-700 relative flex flex-col">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-xl z-50"></div>
            <div className="flex-1 overflow-hidden rounded-[2.5rem] bg-slate-100">
              <AppContent />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-screen w-full">
          <AppContent />
        </div>
      )}

      <button
        onClick={() => setIsMobileSimulation(!isMobileSimulation)}
        className="fixed bottom-6 right-6 z-[100] p-4 bg-slate-900 text-white rounded-full shadow-xl hover:bg-slate-700 transition-all hover:scale-105 group"
        title={isMobileSimulation ? "切換回電腦版" : "切換至手機模擬"}
      >
        {isMobileSimulation ? <Monitor size={24} /> : <Smartphone size={24} />}
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {isMobileSimulation ? "電腦檢視" : "手機預覽"}
        </span>
      </button>
    </>
  );
}

// 渲染到網頁上
const root = createRoot(document.getElementById('root'));
root.render(<App />);