import React, { useEffect, useState } from "react";
import { FiSearch, FiFilter, FiEye, FiCheckCircle, FiXCircle, FiRefreshCcw, FiArrowLeft } from "react-icons/fi";
import { collectionGroup, getDocs, query, doc, updateDoc, collection, where, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function Returns() {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigate("/login");
          return;
        }

        // 1. Fetch all orders for this seller to get valid order IDs
        const ordersQuery = query(collection(db, "orders"), where("sellerId", "==", user.uid));
        const ordersSnap = await getDocs(ordersQuery);
        const sellerOrderIds = new Set();
        const orderDataMap = {};
        ordersSnap.docs.forEach(doc => {
          const d = doc.data();
          sellerOrderIds.add(doc.id);
          orderDataMap[doc.id] = d;
          if (d.orderId) {
            sellerOrderIds.add(d.orderId);
            orderDataMap[d.orderId] = d;
          }
        });

        // 2. Fetch Returns
        const returnsSnap = await getDocs(query(collectionGroup(db, "return_requests")));
        // 3. Fetch Exchanges
        const exchangesSnap = await getDocs(query(collectionGroup(db, "exchange_requests")));

        const allData = [];

        returnsSnap.docs.forEach(doc => {
          const d = doc.data();
          const orderId = d.orderId || doc.id;
          if (sellerOrderIds.has(orderId) || d.sellerId === user.uid || (d.returnedItems && d.returnedItems[0]?.sellerId === user.uid)) {
            allData.push({ id: doc.id, ...d, requestType: 'RETURN', customerId: doc.ref.parent.parent?.id, orderData: orderDataMap[orderId] || null, orderId });
          }
        });

        exchangesSnap.docs.forEach(doc => {
          const d = doc.data();
          const orderId = d.orderId || doc.id;
          if (sellerOrderIds.has(orderId) || d.sellerId === user.uid || (d.itemsToExchange && d.itemsToExchange[0]?.sellerId === user.uid)) {
            allData.push({ id: doc.id, ...d, requestType: 'EXCHANGE', customerId: doc.ref.parent.parent?.id, orderData: orderDataMap[orderId] || null, orderId });
          }
        });

        // Sort by date
        allData.sort((a, b) => {
          const timeA = a.createdAt?.seconds || a.requestedAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || b.requestedAt?.seconds || 0;
          return timeB - timeA;
        });

        setRequests(allData);
        setFilteredRequests(allData);
      } catch (err) {
        console.error("Failed to fetch returns", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [navigate]);

  useEffect(() => {
    let result = requests;
    if (searchTerm) {
      result = result.filter(r =>
        r.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      result = result.filter(r => {
        const s = (r.status || "").toUpperCase();
        if (statusFilter === "PENDING") return s === "PENDING" || s === "RETURN_REQUESTED" || s === "EXCHANGE_REQUESTED";
        if (statusFilter === "APPROVED") return s === "APPROVED" || s === "RETURN_APPROVED" || s === "EXCHANGE_APPROVED";
        if (statusFilter === "REJECTED") return s === "REJECTED" || s === "RETURN_REJECTED" || s === "EXCHANGE_REJECTED";
        return s === statusFilter;
      });
    }
    if (typeFilter !== "all") {
      result = result.filter(r => r.requestType === typeFilter);
    }
    setFilteredRequests(result);
  }, [requests, searchTerm, statusFilter, typeFilter]);

  const handleUpdateStatus = async (requestId, customerId, requestType, newStatus) => {
    try {
      setUpdating(true);
      const req = requests.find(r => r.id === requestId);
      const orderId = req?.orderId || requestId;

      const collectionName = requestType === 'RETURN' ? 'return_requests' : 'exchange_requests';
      const reqRef = doc(db, "users", customerId, collectionName, requestId);
      await updateDoc(reqRef, { status: newStatus, updatedAt: serverTimestamp() });

      try {
        const orderRef = doc(db, "users", customerId, "orders", orderId);
        await updateDoc(orderRef, {
          status: newStatus,
          orderStatus: newStatus.toLowerCase(),
          updatedAt: serverTimestamp()
        });

        const rootOrderRef = doc(db, "orders", orderId);
        await updateDoc(rootOrderRef, {
          status: newStatus,
          orderStatus: newStatus.toLowerCase(),
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Could not update order status:", e);
      }

      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status) => {
    if (!status) return "bg-slate-100 text-slate-800 border-slate-200";
    const s = status.toUpperCase();
    switch (s) {
      case "PENDING":
      case "PENDING_SELLER_APPROVAL":
      case "RETURN_REQUESTED":
      case "EXCHANGE_REQUESTED":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "PENDING_ADMIN_APPROVAL":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "APPROVED":
      case "RETURN_APPROVED":
      case "EXCHANGE_APPROVED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "REFUNDED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "REJECTED":
      case "RETURN_REJECTED":
      case "EXCHANGE_REJECTED":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "PICKUP_SCHEDULED":
      case "FORWARD_SHIPPED":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "COMPLETED":
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] md:ml-72 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Loading returns...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] md:ml-72">
      <div className="pt-20 md:pt-28 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto pb-10">

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Returns & Exchanges</h1>
          <p className="text-sm md:text-base text-slate-500 font-medium mt-1">Review requests from customers</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button 
            onClick={() => setTypeFilter('all')}
            className={`px-6 py-2.5 rounded-full font-black text-sm transition-all ${typeFilter === 'all' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            All Requests
          </button>
          <button 
            onClick={() => setTypeFilter('RETURN')}
            className={`px-6 py-2.5 rounded-full font-black text-sm transition-all ${typeFilter === 'RETURN' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            Returns
          </button>
          <button 
            onClick={() => setTypeFilter('EXCHANGE')}
            className={`px-6 py-2.5 rounded-full font-black text-sm transition-all ${typeFilter === 'EXCHANGE' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            Exchanges
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID or Customer..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 border border-slate-200"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-600 min-w-[240px]"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Return / Exchange Requested</option>
            <option value="PENDING_ADMIN_APPROVAL">Seller Approved (Pending Admin)</option>
            <option value="APPROVED">Approved / Pickup</option>
            <option value="FORWARD_SHIPPED">Forward Shipped</option>
            <option value="REFUNDED">Refunded</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-4 text-left text-xs font-black uppercase text-slate-400">Order ID</th>
                  <th className="px-8 py-4 text-left text-xs font-black uppercase text-slate-400">Product</th>
                  <th className="px-8 py-4 text-left text-xs font-black uppercase text-slate-400">Customer</th>
                  <th className="px-8 py-4 text-left text-xs font-black uppercase text-slate-400">Type</th>
                  <th className="px-8 py-4 text-left text-xs font-black uppercase text-slate-400">Status</th>
                  <th className="px-8 py-4 text-center text-xs font-black uppercase text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRequests.map(req => {
                  const items = req.returnedItems || req.itemsToExchange || [];
                  const firstItem = items[0];

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-900">{req.orderId}</p>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                          {(() => {
                            const dateVal = req.createdAt || req.requestedAt || req.orderData?.createdAt;
                            if (!dateVal) return "N/A";
                            const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
                            return d.toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            });
                          })()}
                        </p>
                      </td>
                      <td className="px-8 py-5">
                        {firstItem ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                              <img
                                src={(firstItem.images && firstItem.images[0]) || firstItem.image || "https://placehold.co/400x400/png?text=No+Image"}
                                alt={firstItem.name}
                                className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 shadow-sm"
                                onError={(e) => { e.target.src = "https://placehold.co/400x400/png?text=No+Image"; }}
                              />
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-sm line-clamp-2">{firstItem.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    {firstItem.variantSize ? `Size: ${firstItem.variantSize}` : "Standard"}
                                  </span>
                                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    Qty: {firstItem.quantity || 1}
                                  </span>
                                </div>
                                <span className="text-sm font-black text-indigo-600 mt-1">
                                  ₹{Number(req.orderData?.totalAmount || firstItem.salePrice || firstItem.price || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            {items.length > 1 && (
                              <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-center mt-1 border border-indigo-100">
                                + {items.length - 1} more item(s) in this request
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm italic bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">No details</span>
                        )}
                      </td>
                      <td className="px-8 py-5 font-medium text-slate-700">{req.customerName || "Customer"}</td>
                      <td className="px-8 py-5">
                        <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full text-xs">
                          {req.requestType}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(req.status)}`}>
                          {['RETURN_APPROVED', 'EXCHANGE_APPROVED', 'APPROVED'].includes(req.status?.toUpperCase()) ? 'APPROVED' : 
                           ['RETURN_REJECTED', 'EXCHANGE_REJECTED', 'REJECTED'].includes(req.status?.toUpperCase()) ? 'REJECTED' : 
                           req.status?.replace(/_/g, ' ') || 'Pending Review'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <button onClick={() => setSelectedRequest(req)} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:text-indigo-600 hover:border-indigo-200">
                          <FiEye size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-16 text-slate-500 font-medium">No return requests found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selectedRequest && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden relative">
                <button onClick={() => setSelectedRequest(null)} className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 hover:text-slate-800 transition-colors z-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
                <div className="p-6 border-b border-slate-100 shrink-0 pr-16">
                  <h3 className="text-xl font-black text-slate-900">Review Request</h3>
                  <p className="text-sm font-bold text-slate-500 mt-1 uppercase">{selectedRequest.orderId}</p>
                </div>
                <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase font-black text-slate-400 mb-1">Type</p>
                      <p className="font-bold text-slate-800">{selectedRequest.requestType}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase font-black text-slate-400 mb-1">Current Status</p>
                      <p className="font-bold text-slate-800">
                        {['RETURN_APPROVED', 'EXCHANGE_APPROVED', 'APPROVED'].includes(selectedRequest.status?.toUpperCase()) ? 'APPROVED' : 
                         ['RETURN_REJECTED', 'EXCHANGE_REJECTED', 'REJECTED'].includes(selectedRequest.status?.toUpperCase()) ? 'REJECTED' : 
                         selectedRequest.status?.replace(/_/g, ' ') || 'Pending Review'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase font-black text-slate-400 mb-1">Reason</p>
                    <p className="font-medium text-slate-700 p-3 bg-slate-50 rounded-xl border border-slate-100">{selectedRequest.reason}</p>
                  </div>

                  {/* Product Details Section */}
                  {(selectedRequest.returnedItems || selectedRequest.itemsToExchange) && (
                    <div>
                      <p className="text-xs uppercase font-black text-slate-400 mb-3">Products</p>
                      <div className="space-y-3">
                        {(selectedRequest.returnedItems || selectedRequest.itemsToExchange).map((item, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 flex gap-4 items-center">
                            <img src={(item.images && item.images[0]) || item.image || "https://placehold.co/400x400/png?text=No+Image"} alt={item.name} className="w-16 h-16 object-cover rounded-lg bg-slate-100" />
                            <div className="flex-1">
                              <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                              <div className="flex justify-between items-center mt-1">
                                <p className="text-xs font-bold text-slate-500">
                                  {item.variantSize ? `Size: ${item.variantSize}` : "Standard"}
                                  {item.newVariantSize ? ` → ${item.newVariantSize}` : ""}
                                </p>
                                <p className="text-sm font-black text-slate-800">Qty: {item.quantity || 1}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-indigo-600">₹{Number(item.salePrice || item.price || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-500 uppercase">Items Total</span>
                          <span className="font-bold text-slate-900">
                            ₹{(selectedRequest.returnedItems || selectedRequest.itemsToExchange).reduce((sum, item) => sum + (Number(item.salePrice || item.price || 0) * Number(item.quantity || 1)), 0).toLocaleString()}
                          </span>
                        </div>
                        {selectedRequest.orderData && selectedRequest.orderData.shippingCost !== undefined && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500 uppercase">Shipping Charge</span>
                            <span className="font-bold text-slate-900">₹{Number(selectedRequest.orderData.shippingCost).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-indigo-100/50">
                          <span className="text-sm font-black text-indigo-600 uppercase">Total Order Amount</span>
                          <span className="text-xl font-black text-slate-900">
                            ₹{((selectedRequest.orderData?.totalAmount) || (selectedRequest.returnedItems || selectedRequest.itemsToExchange).reduce((sum, item) => sum + (Number(item.salePrice || item.price || 0) * Number(item.quantity || 1)), 0)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Evidence Photos */}
                  {selectedRequest.images && selectedRequest.images.length > 0 && (
                    <div>
                      <p className="text-xs uppercase font-black text-slate-400 mb-3">Evidence Photos</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedRequest.images.map((img, idx) => (
                          <a key={idx} href={img} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden border border-slate-200 hover:shadow-md transition-shadow">
                            <img src={img} alt={`Proof ${idx}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedRequest.status === "PENDING_SELLER_APPROVAL" || selectedRequest.status === "RETURN_REQUESTED" || selectedRequest.status === "EXCHANGE_REQUESTED" || selectedRequest.status === "pending" || selectedRequest.status === "RETURN_REQUESTED" ? (
                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                    <button onClick={() => handleUpdateStatus(selectedRequest.id, selectedRequest.customerId, selectedRequest.requestType, selectedRequest.requestType === 'RETURN' ? "RETURN_REJECTED" : "rejected")} disabled={updating} className="flex-1 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold hover:bg-rose-50">Reject</button>
                    <button onClick={() => handleUpdateStatus(selectedRequest.id, selectedRequest.customerId, selectedRequest.requestType, "PENDING_ADMIN_APPROVAL")} disabled={updating} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Approve</button>
                  </div>
                ) : (
                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button onClick={() => setSelectedRequest(null)} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold">Close</button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
