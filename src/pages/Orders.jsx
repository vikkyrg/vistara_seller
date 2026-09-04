import React, { useEffect, useState } from "react";
import {
  FiSearch, FiFilter, FiEye, FiTruck,
  FiShoppingBag, FiClock, FiCheckCircle, FiXCircle, FiTrendingUp,
  FiArrowLeft, FiMoreVertical, FiEdit, FiDownload, FiMessageSquare,
  FiMapPin, FiMail, FiPhone
} from "react-icons/fi";
import { collection, getDocs, query, orderBy, limit, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  const handleUpdateStatus = async (orderId, newStatusValue, newFulfillmentStatus) => {
    try {
      setUpdating(true);

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        orderStatus: newStatusValue,
        status: newStatusValue,
        updatedAt: serverTimestamp()
      });

      const targetOrder = orders.find(o => o.id === orderId);
      const customerId = targetOrder?.customerId || targetOrder?.userId || targetOrder?.uid;

      if (customerId) {
        try {
          const userOrderRef = doc(db, "users", customerId, "orders", orderId);
          await updateDoc(userOrderRef, {
            orderStatus: newStatusValue,
            status: newStatusValue,
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn("Could not update user subcollection", e);
        }
      }

      // Also update seller's own subcollection copy just in case
      const user = auth.currentUser;
      if (user) {
        try {
          const sellerOrderRef = doc(db, "sellers", user.uid, "orders", orderId);
          await updateDoc(sellerOrderRef, {
            orderStatus: newStatusValue,
            status: newStatusValue,
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn("Could not update seller subcollection", e);
        }
      }

      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            orderStatus: newStatusValue,
            status: newStatusValue,
            fulfillmentStatus: newFulfillmentStatus
          };
        }
        return o;
      });
      setOrders(updatedOrders);

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({
          ...prev,
          orderStatus: newStatusValue,
          status: newStatusValue,
          fulfillmentStatus: newFulfillmentStatus
        }));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  // Check mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigate("/login");
          return;
        }

        const q = query(
          collection(db, "orders"),
          where("sellerId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(50)
        );

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => {
          const docData = doc.data();
          let rawStatus = (docData.orderStatus || docData.status || "pending").toLowerCase();
          let fulfillmentStatus = "Pending";

          if (rawStatus === "delivered") fulfillmentStatus = "Delivered";
          else if (rawStatus === "processing") fulfillmentStatus = "Processing";
          else if (rawStatus === "ready to ship") fulfillmentStatus = "Ready to ship";
          else if (rawStatus === "shipped") fulfillmentStatus = "Shipped";
          else if (rawStatus === "cancelled") fulfillmentStatus = "Cancelled";
          else if (rawStatus === "return_requested") fulfillmentStatus = "Return Requested";
          else if (rawStatus === "pending_admin_approval") fulfillmentStatus = "Pending Admin Approval";
          else if (rawStatus === "return_approved") fulfillmentStatus = "Return Approved";
          else if (rawStatus === "refunded") fulfillmentStatus = "Refunded";
          else if (rawStatus === "return_rejected") fulfillmentStatus = "Return Rejected";
          else if (rawStatus === "exchange_requested" || rawStatus === "exchange_requested") fulfillmentStatus = "Exchange Requested";
          else if (rawStatus === "exchange_approved") fulfillmentStatus = "Exchange Approved";
          else if (rawStatus === "forward_shipped") fulfillmentStatus = "Forward Shipped";

          let paymentMethod = docData.paymentMethod || "PREPAID";

          return {
            id: doc.id,
            ...docData,
            fulfillmentStatus,
            paymentMethod,
            createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : new Date(docData.createdAt)
          };
        });

        setOrders(data);
        setFilteredOrders(data);
      } catch (err) {
        console.error("Failed to fetch orders", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [navigate]);

  // Apply filters
  useEffect(() => {
    let result = orders;

    // Search filter
    if (searchTerm) {
      result = result.filter(o =>
        o.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(o => o.fulfillmentStatus === statusFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoffDate = new Date();

      switch (dateFilter) {
        case "today":
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "month":
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }

      result = result.filter(o => {
        const orderDate = o.createdAt;
        return orderDate >= cutoffDate;
      });
    }

    setFilteredOrders(result);
  }, [orders, searchTerm, statusFilter, dateFilter]);

  const statusConfig = {
    Delivered: {
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
      bg: "bg-emerald-500",
      icon: <FiCheckCircle />
    },
    Processing: {
      color: "text-blue-700 bg-blue-50 border-blue-200",
      bg: "bg-blue-500",
      icon: <FiClock />
    },
    "Ready to ship": {
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
      bg: "bg-indigo-500",
      icon: <FiClock />
    },
    Shipped: {
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
      bg: "bg-indigo-500",
      icon: <FiTruck />
    },
    Cancelled: {
      color: "text-rose-700 bg-rose-50 border-rose-200",
      bg: "bg-rose-500",
      icon: <FiXCircle />
    },
    Pending: {
      color: "text-amber-700 bg-amber-50 border-amber-200",
      bg: "bg-amber-500",
      icon: <FiClock />
    },
    "Return Requested": {
      color: "text-orange-700 bg-orange-50 border-orange-200",
      bg: "bg-orange-500",
      icon: <FiShoppingBag />
    },
    "Pending Admin Approval": {
      color: "text-purple-700 bg-purple-50 border-purple-200",
      bg: "bg-purple-500",
      icon: <FiClock />
    },
    "Return Approved": {
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
      bg: "bg-emerald-500",
      icon: <FiCheckCircle />
    },
    "Refunded": {
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
      bg: "bg-emerald-500",
      icon: <FiCheckCircle />
    },
    "Return Rejected": {
      color: "text-rose-700 bg-rose-50 border-rose-200",
      bg: "bg-rose-500",
      icon: <FiXCircle />
    },
    "Exchange Requested": {
      color: "text-blue-700 bg-blue-50 border-blue-200",
      bg: "bg-blue-500",
      icon: <FiShoppingBag />
    },
    "Exchange Approved": {
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
      bg: "bg-indigo-500",
      icon: <FiCheckCircle />
    },
    "Forward Shipped": {
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
      bg: "bg-indigo-500",
      icon: <FiTruck />
    },
  };

  const totalRevenue = orders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  const pendingOrders = orders.filter(o => o.fulfillmentStatus === "Pending").length;
  const processingOrders = orders.filter(o => o.fulfillmentStatus === "Processing").length;
  const deliveredOrders = orders.filter(o => o.fulfillmentStatus === "Delivered").length;

  const stats = [
    {
      label: "Total Revenue",
      val: `₹${totalRevenue.toLocaleString()}`,
      icon: <FiTrendingUp />,
      color: "text-emerald-600",
      bg: "bg-gradient-to-br from-emerald-50 to-green-50",
      change: "+12.5%"
    },
    {
      label: "Pending",
      val: pendingOrders,
      icon: <FiClock />,
      color: "text-amber-600",
      bg: "bg-gradient-to-br from-amber-50 to-yellow-50",
      change: `+${Math.round((pendingOrders / orders.length) * 100) || 0}%`
    },
    {
      label: "Processing",
      val: processingOrders,
      icon: <FiClock />,
      color: "text-blue-600",
      bg: "bg-gradient-to-br from-blue-50 to-cyan-50",
      change: `+${Math.round((processingOrders / orders.length) * 100) || 0}%`
    },
    {
      label: "Delivered",
      val: deliveredOrders,
      icon: <FiCheckCircle />,
      color: "text-emerald-600",
      bg: "bg-gradient-to-br from-emerald-100 to-green-100",
      change: `+${Math.round((deliveredOrders / orders.length) * 100) || 0}%`
    },
  ];

  const formatDate = (date) => {
    if (!date) return "N/A";
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
  };

  const handleCloseOrderDetails = () => {
    setSelectedOrder(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] md:ml-72 flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"
        />
        <p className="text-slate-500 font-medium animate-pulse">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] md:ml-72">
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between md:hidden">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-700"
          >
            <FiArrowLeft className="text-lg" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-sm font-bold text-slate-900">Orders ({orders.length})</h1>
          <button className="p-2">
            <FiFilter className="text-slate-600" />
          </button>
        </div>
      )}

      <div className={`pt-16 md:pt-28 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl mx-auto ${isMobile ? 'pb-24' : 'pb-10'}`}>
        {/* Desktop Header */}
        <div className={`${isMobile ? 'hidden md:block' : ''} mb-6 md:mb-10`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                Order Management
              </h1>
              <p className="text-sm md:text-base text-slate-500 font-medium">
                Tracking {orders.length} total customer purchases
              </p>
            </div>
            <button className="hidden md:flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
              <FiDownload className="text-sm" /> Export Orders
            </button>
          </div>
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-10">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${stat.bg} ${stat.color} text-lg md:text-xl`}>
                  {stat.icon}
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  {stat.change}
                </span>
              </div>
              <div className="mt-3 md:mt-4">
                <p className="text-[10px] md:text-xs uppercase font-black text-slate-400 tracking-widest">
                  {stat.label}
                </p>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
                  {stat.val}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* SEARCH & FILTER SECTION */}
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm md:text-base" />
                <input
                  type="text"
                  placeholder="Search by Order ID, Customer, or Email..."
                  className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium border border-slate-200 focus:border-indigo-500 text-sm md:text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm md:text-base"
              >
                <option value="all">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Return Requested">Return Requested</option>
                <option value="Pending Admin Approval">Pending Admin Approval</option>
                <option value="Return Approved">Return Approved</option>
                <option value="Refunded">Refunded</option>
                <option value="Return Rejected">Return Rejected</option>
                <option value="Exchange Requested">Exchange Requested</option>
                <option value="Exchange Approved">Exchange Approved</option>
                <option value="Forward Shipped">Forward Shipped</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm md:text-base"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>

              <button className="hidden sm:flex items-center justify-center gap-2 px-4 md:px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">
                <FiFilter /> Apply Filters
              </button>
            </div>
          </div>

          {/* Mobile Filter Button */}
          {isMobile && (
            <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">
              <FiFilter /> Apply Filters ({filteredOrders.length} results)
            </button>
          )}
        </div>

        {/* MOBILE ORDER CARDS */}
        <div className="md:hidden space-y-3">
          <AnimatePresence>
            {filteredOrders.map((order, idx) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm"
                onClick={() => handleOrderClick(order)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3 items-center">
                    <div className="relative w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs overflow-hidden border border-slate-100 flex-shrink-0">
                      {order.products?.[0]?.image || order.products?.[0]?.images?.[0] ? (
                        <>
                          <img src={order.products[0].image || order.products[0].images[0]} alt="Product" className="w-full h-full object-cover" />
                          {order.products.length > 1 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">
                              +{order.products.length - 1}
                            </div>
                          )}
                        </>
                      ) : (
                        <FiShoppingBag size={16} />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{order.orderId || `#ORD${order.id.slice(0, 8)}`}</p>
                      <p className="text-xs text-slate-500 mt-1">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <select
                      value={(order.orderStatus || order.status || "pending").toLowerCase()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const val = e.target.value;
                        let displayVal = "Pending";
                        if (val === "delivered") displayVal = "Delivered";
                        else if (val === "processing") displayVal = "Processing";
                        else if (val === "ready to ship") displayVal = "Ready to ship";
                        else if (val === "shipped") displayVal = "Shipped";
                        else if (val === "cancelled") displayVal = "Cancelled";
                        handleUpdateStatus(order.id, val, displayVal);
                      }}
                      disabled={updating}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold outline-none cursor-pointer ${statusConfig[order.fulfillmentStatus]?.color || "bg-slate-100 text-slate-600"}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="ready to ship">Ready to ship</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {order.paymentMethod || "PREPAID"}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{order.customerName || "Customer"}</p>
                    <p className="text-xs text-slate-500">{order.customerEmail || "No email"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-slate-900">{formatCurrency(order.totalAmount || 0)}</p>
                    <p className="text-xs text-slate-500">{order.quantity || 1} item(s)</p>
                  </div>
                </div>

                <div className="flex items-center justify-center pt-3 border-t border-slate-100">
                  <div className="w-full">
                    <button className="w-full p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                      <FiEye size={16} />
                      View Details
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredOrders.length === 0 && (
            <div className="text-center py-10">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiShoppingBag className="text-slate-300" size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No orders found</h3>
              <p className="text-slate-500 text-sm mt-1">Try changing your search or filters</p>
            </div>
          )}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 lg:px-8 py-4 text-left text-xs font-black uppercase text-slate-400 tracking-widest">
                    Order Details
                  </th>
                  <th className="px-6 lg:px-8 py-4 text-left text-xs font-black uppercase text-slate-400 tracking-widest">
                    Customer
                  </th>
                  <th className="px-6 lg:px-8 py-4 text-left text-xs font-black uppercase text-slate-400 tracking-widest">
                    Amount
                  </th>
                  <th className="px-6 lg:px-8 py-4 text-left text-xs font-black uppercase text-slate-400 tracking-widest">
                    Status
                  </th>
                  <th className="px-6 lg:px-8 py-4 text-center text-xs font-black uppercase text-slate-400 tracking-widest">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence>
                  {filteredOrders.map((order, idx) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-6 lg:px-8 py-5">
                        <div className="flex items-center gap-3 lg:gap-4">
                          <div className="relative w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm overflow-hidden border border-slate-100 flex-shrink-0">
                            {order.products?.[0]?.image || order.products?.[0]?.images?.[0] ? (
                              <>
                                <img src={order.products[0].image || order.products[0].images[0]} alt="Product" className="w-full h-full object-cover" />
                                {order.products.length > 1 && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">
                                    +{order.products.length - 1}
                                  </div>
                                )}
                              </>
                            ) : (
                              `#${idx + 1}`
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                              {order.orderId || `#ORD${order.id.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 lg:px-8 py-5">
                        <p className="text-sm font-bold text-slate-700">{order.customerName || "Customer"}</p>
                        <p className="text-xs text-slate-500">{order.customerEmail || "No email provided"}</p>
                      </td>
                      <td className="px-6 lg:px-8 py-5">
                        <span className="text-base font-bold text-slate-900">
                          {formatCurrency(order.totalAmount || 0)}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">{order.quantity || 1} item(s)</p>
                      </td>
                      <td className="px-6 lg:px-8 py-5">
                        <div className="flex flex-col items-start gap-2">
                          <select
                            value={(order.orderStatus || order.status || "pending").toLowerCase()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const val = e.target.value;
                              let displayVal = "Pending";
                              if (val === "delivered") displayVal = "Delivered";
                              else if (val === "processing") displayVal = "Processing";
                              else if (val === "ready to ship") displayVal = "Ready to ship";
                              else if (val === "shipped") displayVal = "Shipped";
                              else if (val === "cancelled") displayVal = "Cancelled";
                              else if (val === "return_requested") displayVal = "Return Requested";
                              else if (val === "pending_admin_approval") displayVal = "Pending Admin Approval";
                              else if (val === "return_approved") displayVal = "Return Approved";
                              else if (val === "refunded") displayVal = "Refunded";
                              else if (val === "return_rejected") displayVal = "Return Rejected";
                              else if (val === "exchange_requested") displayVal = "Exchange Requested";
                              else if (val === "exchange_approved") displayVal = "Exchange Approved";
                              else if (val === "forward_shipped") displayVal = "Forward Shipped";
                              handleUpdateStatus(order.id, val, displayVal);
                            }}
                            disabled={updating}
                            className={`inline-flex items-center px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs font-bold uppercase tracking-tighter border outline-none cursor-pointer ${statusConfig[order.fulfillmentStatus]?.color || "bg-slate-100 text-slate-600 border-slate-200"}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="ready to ship">Ready to ship</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="return_requested">Return Requested</option>
                            <option value="pending_admin_approval">Pending Admin Approval</option>
                            <option value="return_approved">Return Approved</option>
                            <option value="refunded">Refunded</option>
                            <option value="return_rejected">Return Rejected</option>
                            <option value="exchange_requested">Exchange Requested</option>
                            <option value="exchange_approved">Exchange Approved</option>
                            <option value="forward_shipped">Forward Shipped</option>
                          </select>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            {order.paymentMethod || "PREPAID"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 lg:px-8 py-5">
                        <div className="flex justify-center gap-2 lg:gap-3">
                          <button
                            onClick={() => handleOrderClick(order)}
                            className="p-2.5 bg-white border border-slate-100 shadow-sm text-slate-600 rounded-xl hover:text-indigo-600 hover:border-indigo-100 transition-all">
                            <FiEye size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-16 lg:py-20">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiShoppingBag className="text-slate-300" size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No matching orders</h3>
              <p className="text-slate-500 text-sm mt-2">We couldn't find any orders matching your search.</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setDateFilter("all");
                }}
                className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        <AnimatePresence>
          {selectedOrder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={handleCloseOrderDetails}
            >
              <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Order Details</h3>
                    <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{selectedOrder.orderId}</p>
                  </div>
                  <button
                    onClick={handleCloseOrderDetails}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-5 space-y-6">
                  {/* Customer & Amount */}
                  <div className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1.5">Customer Info</p>
                      <p className="font-black text-lg text-slate-900 mb-2">{selectedOrder.customerName || "Customer"}</p>
                      {selectedOrder.customerEmail && (
                        <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                          <FiMail size={14} className="text-slate-400" />
                          <p className="text-sm font-medium">{selectedOrder.customerEmail}</p>
                        </div>
                      )}
                      {selectedOrder.customerPhone && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <FiPhone size={14} className="text-slate-400" />
                          <p className="text-sm font-medium">{selectedOrder.customerPhone}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1.5">Total Amount</p>
                      <p className="font-black text-2xl text-indigo-600">{formatCurrency(selectedOrder.totalAmount || 0)}</p>
                    </div>
                  </div>

                  {/* Status & Payment & Date */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Status</p>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${statusConfig[selectedOrder.fulfillmentStatus]?.color}`}>
                        {statusConfig[selectedOrder.fulfillmentStatus]?.icon}
                        {selectedOrder.fulfillmentStatus}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Payment</p>
                      <span className="inline-block bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-black text-slate-700 shadow-sm">
                        {selectedOrder.paymentMethod || "PREPAID"}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Order Date</p>
                      <p className="font-bold text-slate-800 text-sm mt-1">{formatDate(selectedOrder.createdAt)}</p>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div>
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 px-1">Shipping Address</p>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                      <div className="mt-0.5 text-indigo-500 bg-indigo-100 p-2 rounded-lg">
                        <FiMapPin size={16} />
                      </div>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed pt-1">
                        {selectedOrder.address ? `${selectedOrder.address}, ${selectedOrder.city}, ${selectedOrder.state} - ${selectedOrder.pinCode}` : "Not provided"}
                      </p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <div className="flex justify-between items-center mb-2 px-1">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Order Items</p>
                      <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{selectedOrder.products?.length || 0} items</p>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {selectedOrder.products?.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-4 bg-white border border-slate-100 shadow-sm rounded-2xl hover:border-indigo-200 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0 p-1.5">
                              <img src={item.image || item.images?.[0] || 'https://via.placeholder.com/150'} alt={item.name} className="w-full h-full object-contain rounded-lg" />
                            </div>
                            <div className="flex flex-col justify-center">
                              <p className="text-base sm:text-lg font-bold text-slate-800 line-clamp-2 leading-tight">{item.name}</p>
                              <p className="text-sm font-medium text-slate-500 mt-1.5">Qty: <span className="text-slate-700 font-bold">{item.quantity}</span></p>
                            </div>
                          </div>
                          <p className="text-base sm:text-lg font-black text-slate-900 whitespace-nowrap ml-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">{formatCurrency((item.salePrice || item.price) * item.quantity)}</p>
                        </div>
                      )) || (
                          <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                            <FiShoppingBag className="text-slate-300 mb-2" size={24} />
                            <p className="text-sm font-medium text-slate-500">No item details available</p>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Count */}
        <div className="mt-6 text-center text-sm text-slate-500">
          Showing {filteredOrders.length} of {orders.length} orders
        </div>
      </div>
    </div>
  );
}